---
---

Element.prototype.remove = function() {
	this.parentElement.removeChild(this);
}
NodeList.prototype.remove = HTMLCollection.prototype.remove = function() {
	for(var i = this.length - 1; i >= 0; i--) {
		if(this[i] && this[i].parentElement) {
			this[i].parentElement.removeChild(this[i]);
		}
	}
}
// apiUrl obtained from Google Apps Script
var apiUrl = "{{site['jekyll-comments']['apiUrl']}}";

var user = {"name": "", "email": "", "image": ""}
var activeThread = "c"
localStorage.setItem("u", JSON.stringify(user))

function print_comment_msg(msg, t) {
	var comment_msg = document.getElementById('comment_msg');
	comment_msg.classList.add('active');
	comment_msg.classList.add(t);
	comment_msg.innerHTML = msg;
	setTimeout(function() {
		comment_msg.classList.remove('active');
		comment_msg.classList.remove(t);
	}, 3000);
}


function is_bad_markdown(s) {
	s = s.split(/```/);
	var is_broken = false;
	if (s.length % 2 == 0) { //odd number of markdown ``` means not closed
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
			} else {
				// nothing
			}
		}
	}
	return false;
}


function allow_comment(name, email, p, id, ct){
	var comment_content = document.getElementById("comment_content")
	if (name === "0" || name === "" || name.length < 2){
		print_comment_msg("You must be logged in with Google to post a comment.", "error")
		return false
	}
	if (ct.length < 15){
		comment_content.classList.add("invalid");
		print_comment_msg("The content in your comment doesn't seem much informative. Extend it?", "error")
		return false
	}else if(is_bad_markdown(ct)){
		print_comment_msg("Your comment contains invalid syntax or has HTML that doesn't belong in a markdown code block.", "error")
		comment_content.classList.add("invalid");
		return false
	}else {
		comment_content.classList.remove("invalid")
	}
	return true
}

function handle_comment_response(res) {
	switch(res){
		case "successfully added":
			var comment_content = document.getElementById("comment_content");
			comment_content.value = "";
			comment_content.classList.add('success');
			setTimeout(function() {
				comment_content.classList.remove('success');
			}, 4000);
			print_comment_msg("Your comment was successfully added. It'll be visible on our website after moderation by humans.", "success")
			break;
		case "content not allowed":
			print_comment_msg("Our robots detected that your comment contains some invalid characters or profanity or html outside markdown. Please edit it, else it won't be accepted.", "error")
			break;
		case "you are not allowed":
			print_comment_msg("Oops! Appears your are blacklisted to post comments! Think something is wrong? Contact a human.", "error")
			break;
		default:
			print_comment_msg("Some error occured. Try again.", "error")
	}
}


function postComment() {
	var slug = document.getElementById('addComment').getAttribute("data-slug");
	var user = JSON.parse(localStorage.getItem("u"))
	var name = encodeURIComponent(user.name);
	var email = encodeURIComponent(user.email);
	var image = encodeURIComponent(user.image);
	var comment_content = document.getElementById('comment_content')
	var ct = comment_content.value;
	var comment_loader = document.getElementById('comment_loader');
	var user_details = document.getElementById('user_details');

	var requestBody =  "mode=post&name=" + name + "&email=" + email + "&image=" + image +  "&p=" + activeThread + "&slug=" + slug + "&url=" + encodeURIComponent(window.location.pathname) + "&ct=" + encodeURIComponent(ct);

	comment_loader.classList.add('active');
	user_details.classList.add('disabled');

	if (!allow_comment(name, email, activeThread, slug, ct)) {
		comment_loader.classList.remove('active');
		return false
	}
	comment_content.classList.add('disabled');

	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("post", apiUrl, true);
	xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded; charset=UTF-8");
	xmlhttp.onreadystatechange = function() {
	    if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
	        handle_comment_response(xmlhttp.responseText);
    		comment_loader.classList.remove('active');
			comment_content.classList.remove('disabled');
			user_details.classList.remove('disabled');
	    }
	}
	xmlhttp.send(requestBody);	
}


function addComment() {
	document.getElementsByClassName("comment-form").remove();
	activeThread = "c"
	document.getElementById('addComment').innerHTML = '<form class="comment-form">' + 
		'<div class="load-bar" id="comment_loader"><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>' +
		'<textarea rows="5" id="comment_content" placeholder="Join the discussion.."></textarea>' +
		'<div id="comment_msg"></div>' +
		'<div id="user_panel"><div id="user_details"></div><div id="my-signin2"></div><div id="signout"><span onclick="signOut();">Sign out</span></div>' + 
		'</form>'
	updateUserDetails()
	renderButton()
	autosize()
}

function reply(to, trigger) {
	activeThread = to.id.split("-")[0];
	console.log(to, trigger, activeThread)
	var ht = '<form class="comment-form">' + 
		'<div class="load-bar" id="comment_loader"><div class="bar"></div><div class="bar"></div><div class="bar"></div></div>' +
		'<textarea rows="5" id="comment_content">[@'+to.name+'](#'+to.id+') </textarea>' +
		'<div id="comment_msg"></div>' + 
		'<div id="user_panel"><div id="user_details"></div><div id="my-signin2"></div><div id="signout"><span onclick="signOut();">Sign out</span></div>' + 
		'<a onclick="document.getElementsByClassName(\'comment-form\').remove(); addComment();">Cancel</a>' + 
		'</form>'
	document.getElementsByClassName("comment-form").remove();
	trigger.insertAdjacentHTML('afterend', ht);
	updateUserDetails()
	renderButton()
	autosize()
	var text = document.getElementById('comment_content');
	var v = text.value;
    text.focus();
    text.value = "";
    text.value = v;
}


var observe;
if (window.attachEvent) {
	observe = function (element, event, handler) {
		element.attachEvent('on'+event, handler);
	};
}
else {
	observe = function (element, event, handler) {
		element.addEventListener(event, handler, false);
	};
}
function autosize() {
	var text = document.getElementById('comment_content');
	function resize () {
		text.style.height = 'auto';
		text.style.height = text.scrollHeight+'px';
	}
	/* 0-timeout to get the already changed text */
	function delayedResize () {
		window.setTimeout(resize, 0);
	}
	observe(text, 'change',  resize);
	observe(text, 'cut',     delayedResize);
	observe(text, 'paste',   delayedResize);
	observe(text, 'drop',    delayedResize);
	observe(text, 'keydown', delayedResize);
	observe(text, 'keydown', function(){
		this.classList.remove('invalid');
		document.getElementById('user_details').classList.remove('disabled');
	});
	resize();
}

autosize()

var replyBtns = document.querySelectorAll("a.action-reply")
for (var i = replyBtns.length - 1; i >= 0; i--) {
	replyBtns[i].onclick = function() {
		var to = {}
		var trigger = this.closest(".com")
		to.name = this.closest(".comment-meta").querySelector('.user-name').innerHTML
		to.id = trigger.id
		reply(to, trigger)
	}
}

// view local comment timestamps
var comment_timestamps = document.querySelectorAll('.comment-date')
for (var i = comment_timestamps.length - 1; i >= 0; i--) {
	comment_timestamps[i].setAttribute('title', new Date(comment_timestamps[i].getAttribute('title').replace('T', ' ')))
}

function onFailure(error) {
	console.log(error);
}

function updateUserDetails(){
	var user_details = document.getElementById("user_details")
	var user = JSON.parse(localStorage.getItem("u"))
	if (user.name !== ""){
		var userDetails = "<span class='user_image'><img src='"+user.image+"'/></span> <span class='user_name'><span>Post comment as</span>"+user.name+"</span> "
		user_details.innerHTML = userDetails;
		user_details.classList.add('active');
		document.getElementById('signout').classList.add('active')
		user_details.onclick = function(){
			postComment(); 
		}
	}
}

function onSignIn(googleUser) {
	var profile = googleUser.getBasicProfile();
	var user = {
		"name": profile.getName(),
		"image": profile.getImageUrl(),
		"email": profile.getEmail()
	}
	localStorage.setItem("u", JSON.stringify(user))
	updateUserDetails()
}

function signOut() {
	var auth2 = gapi.auth2.getAuthInstance();
	auth2.signOut().then(function() {
		user = {"name": "", "email": "", "image": ""};
		localStorage.setItem("u", JSON.stringify(user));
		var user_details = document.getElementById("user_details")
		user_details.innerHTML = "";
		user_details.classList.remove('active');
		document.getElementById('signout').classList.remove('active')
		console.log('User signed out.');
	});
}


function renderButton() {
	gapi.signin2.render('my-signin2', {
		'scope': 'profile email',
		'longtitle': false,
		'theme': 'dark',
		'onsuccess': onSignIn,
		'onfailure': onFailure,
	});
}