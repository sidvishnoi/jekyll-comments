var settings = {
	"deleteKey": "123456789", 
	// keep this key safe, same as the key in comments.py
	"checkProfanity": true,
	// if set to true, this will use a public API to check to profanity in comment body. 
	// Set true only if comments are not very long in length and do not include a lot of code and freespaces, 
	// otherwise it generally finds profanity even if there is no profanity
}
var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("pending");

function doGet(e) {
	return handleResponse(e);
}

function doPost(e) {
	return handleResponse(e);
}

function disallow_user(user) {
	// check user in <user_blacklist> sheet, tested based of user (email)
	var blacklist = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("user_blacklist").getRange("a:a").getValues().toString()
	if (blacklist.indexOf(user) > -1) {
		return true; // block user
	} else {
		return false; // allow
	}
}

function markdown_is_bad(s) {
	// currently doesn't allow inline amrkdown code also - TODO
	s = decodeURIComponent(s)
	s = s.split(/```/);
	var is_broken = false;
	if (s.length % 2 == 0) {
		is_broken = true;
		return true
	}

	if (!is_broken) {
		var in_markdown = false;
		for (var i in s) {
			in_markdown = i % 2 == 1;
			if (!in_markdown) {
				s[i] = s[i].match(/<[a-z\/][^>]*>/g);
				if (s[i] != null) return true
			}
		}
	}
	return false;
}

function disallow_content(content) {
	/* XSS regex check */
	if (markdown_is_bad(decodeURIComponent(content))) return true;

	/* Profanity check via api */
	if (settings["checkProfanity"]) {
		var api_response = false;
		content = decodeURIComponent(content).replace('/(?:\r\n|\r|\n)/g', '').split("\n").join();
		var l = content.length;
		var chunksize = 500;
		if (l > chunksize) {
			// break text in smaller parts - needed in URLFetchApp and in API (supports only get request)
			for (var i = 0; i < l; i += chunksize) {
				var chunk = content.substring(i, i + chunksize);
				var intermediate_response = UrlFetchApp.fetch("http://www.purgomalum.com/service/containsprofanity?text=" + encodeURIComponent(chunk));
				api_response = api_response || (intermediate_response == "true" ? true : false);
				if (api_response == true) {
					return true; // contains profanity
				}
			}
		} else {
			api_response = UrlFetchApp.fetch("http://www.purgomalum.com/service/containsprofanity?text=" + encodeURIComponent(content));
			if (api_response == "true") {
				return true;
			}
		}
	}

	/* check in <profanity_blacklist> */
	var profanity_sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("profanity_blacklist");
	var blacklisted_words = profanity_sheet.getRange("a:a" + profanity_sheet.getLastRow()).getValues().toString().split(",");
	var l = blacklisted_words.length;
	for (var i = 0; i < l; i++) {
		if (blacklisted_words[i] !== "" && content.toLowerCase().indexOf(blacklisted_words[i].toLowerCase()) > -1) {
			return true; // contains a blacklisted word
		}
	}
	/* else allow content */
	return false;
}

function blacklist(user, commentId) {
	// add a user to <user_blacklist>
	SpreadsheetApp.getActiveSpreadsheet().getSheetByName("user_blacklist").appendRow([user]);
	deleteComment(commentId); // delete from pending sheet
}

function deleteComment(commentId) {
	// delete a comment from <pending>
	sheet.deleteRows(parseInt(commentId) + 1, 1); // delete from pending sheet
}

function addComment(e) {
	// add a comment to <pending>
	try {
		var name = e.parameter.name;
		var email = e.parameter.email;
		var ct = e.parameter.ct;
		var parent = e.parameter.p;
		var slug = e.parameter.slug;
		var url = e.parameter.url;
		var image = e.parameter.image;
		var formattedDate = Utilities.formatDate(new Date(), "GMT", "yyyy-MM-dd'T'HH:mm:ss'Z'");
		if (disallow_user(email)) return "you are not allowed"; // user not allowed	
		if (disallow_content(ct)) return "content not allowed"; // block based on content
		sheet.appendRow([formattedDate, slug, url, parent, name, image, email, ct]);
		return "successfully added";
	} catch (e) {
		return e;
	}
}


function getjson() {
	// returns the <pending> comments JSON
	var rows = sheet.getDataRange();
	var numRows = rows.getNumRows();
	var numCols = rows.getNumColumns();
	var values = rows.getValues();

	var tt = "";
	tt += '{\n\t"pending" : [\n';
	var header = values[0];
	for (var i = 1; i < numRows; ++i) {
		tt += '\t{\n';
		var row = values[i];
		for (var j = 0; j < numCols; ++j) {
			tt += ' \t "' + header[j] + '" : "' + encodeURIComponent(row[j]) + ((j == numCols - 1) ? '"\n' : '", \n');
		}
		tt += (i == numRows - 1) ? '\t}\n' : '\t},\n';
	}
	tt += '\t]\n}';
	return tt;
}

function movePending(len) {
	// moves content of <pending> to <published>
	var rows = sheet.getDataRange();
	var numCols = rows.getNumColumns();
	var range = sheet.getRange(2, 1, len, numCols).getValues();
	var sheet2 = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("published");
	sheet2.getRange(sheet2.getLastRow() + 1, 1, len, numCols).setValues(range);
	sheet.deleteRows(2, len);
}

function handleResponse(e) {
	// this prevents concurrent access overwritting data
	// [1] https://gsuite-developers.googleblog.com/2011/10/concurrency-and-google-apps-script.html
	// we want a public lock, one that locks for all invocations
	var lock = LockService.getPublicLock();
	lock.waitLock(30000); // wait 30 seconds before conceding defeat.

	try {
		var mode = e.parameter.mode;

		if (mode === "post") {
			return ContentService.createTextOutput(addComment(e));
		} else if (mode === "get") {
			return ContentService.createTextOutput(getjson());
		} else if (mode === "clear") {
			if (e.parameter.key === settings["deleteKey"]) {
				movePending(e.parameter.len);
				return ContentService.createTextOutput("pending moved");
			} else {
				return ContentService.createTextOutput("moving failed");
			}
		} else if (mode === "delete") {
			if (e.parameter.key === settings["deleteKey"]) {
				deleteComment(e.parameter.commentId);
				return ContentService.createTextOutput("comment deleted");
			} else {
				return ContentService.createTextOutput("delete failed");
			}
		} else if (mode === "blacklist") {
			if (e.parameter.key === settings["deleteKey"]) {
				blacklist(e.parameter.email, e.parameter.commentId);
				return ContentService.createTextOutput("user blacklisted");
			} else {
				return ContentService.createTextOutput("blacklist failed");
			}
		} else {
			return ContentService.createTextOutput("idk something happened");
		}
	} catch (e) {
		// if error return this
		return ContentService.createTextOutput(e);
	} finally { //release lock
		lock.releaseLock();
	}
}