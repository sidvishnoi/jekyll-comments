import requests, yaml, json
import mdv 	# recommended mdv themes:	729.8953	960.847	785.3229	880.1331	696.6153
from urllib import unquote
from sys import argv as cli_args
from hashlib import md5
from datetime import datetime, timedelta
from time import timezone
from dateutil.parser import parse 


def print_error():
	st = '\x1b[1;31;40m' # bold red color
	st += "Comment with same timestamp already in comments."
	st += '\x1b[0m' # normal color
	print st


def printDetails(data, ctype = 0):
	data["comment_date"] = data["comment_date"] - timedelta(seconds=timezone)
	st = "[" + ("COMMENT" if ctype == 0 else "REPLY") + "]\n\n"
	st += "Author: " + data["comment_author"] + " (**" + data["comment_email"] + "**) \n\n"
	st += "Date: (UTC) " + data["comment_date"].strftime("%A, %d %B %Y %I:%M%p") + "\n\n"
	st += "URL: " + data["comment_url"] + "\n"
	st += "\n\n\n ============ \n\n\n"
	print mdv.main(st, theme='880.1331')
	print mdv.main(data["comment_content"], theme='880.1331')

def moderateMsg(settings, data, func):
	if settings["passAll"] == False:
		cont = raw_input(mdv.main("Type [d] to delete, [b] to blacklist user, [p] or any other key to allow: ", theme='880.1331'))
		if cont == "d":
			deleteComment(settings)
			return "None"
		elif cont == "b":
			blacklist(settings, data["comment_email"])
			return "None"
	settings["files_updated"].append(data["comment_slug"] + ".md\n")
	return func

def newCommentBody(data, ctype, parent, settings):
	return {
	"comment" if ctype == 0 else "reply": None,
	"id": parent,
	"date": data["comment_date"].isoformat(),
	"user": data["comment_author"],
	"email": md5(data["comment_email"]).hexdigest() if settings["saveAsmd5"] else data["comment_email"],
	"image": data["comment_image"],
	"content": data["comment_content"]
	}

def blacklist(settings, user):
	print "blacklisting user and deleting comment."
	url = settings["apiUrl"] + "?mode=blacklist&key=" + settings["deleteKey"] + "&commentId=" + str(settings["comment_counter"]) + "&email=" + user
	print url
	settings["comment_counter"] -= 1
	r = requests.get(url, allow_redirects=True)
	print r.text
	return 0

def deleteComment(settings):
	print "deleting comment."
	url = settings["apiUrl"] + "?mode=delete&key=" + settings["deleteKey"] + "&commentId=" + str(settings["comment_counter"])
	print url
	settings["comment_counter"] -= 1
	r = requests.get(url, allow_redirects=True)
	print r.text
	return 0

def deletePending(settings, length):
	if length > 0:
		print "moving comments from pending to published sheet."
		url = settings["apiUrl"] + "?mode=clear&key=" + settings["deleteKey"] + "&len=" + str(length)
		r = requests.get(url, allow_redirects=True)
		print r.text
	else:
		print "All Done."
	

def updateComments(settings):
	# CHECK AND EDIT SETTINGS
	try:
		f = open('_config.yml')
		y = yaml.load(f)
	except IOError:
		print '\x1b[1;31;40m' + "Coudn't read _config.yml" + '\x1b[0m'
		return

	try:
		jComments = y["jekyll-comments"]
	except KeyError:
		print '\x1b[1;31;40m' + "Coudn't read <jekyll-comments> in _config.yml" + '\x1b[0m'
		return

	try:
		settings["commentsDir"] = "_data/comments/" if jComments["commentsDir"] == '' else jComments["commentsDir"]
		# this is where are comments are saved
		# default: "_data/comments/"
		settings["logFile"] = "jekyll-comments/comments.log" if jComments["logFile"] == '' else jComments["logFile"]
		# this file will keep a list of files in which comments are updated, useful in partial builds. 
		# default: "jekyll-comments/comments.log"
		settings["apiUrl"] = jComments["apiUrl"]
		# [REQUIRED] the url you received from Google Apps Script step, e.g.
		# "apiUrl": "https://script.google.com/macros/s/AKfycbyTwxtrSxu...g5Guoj5KiKsPMyh4aXQ6c_/exec", 
		settings["saveAsmd5"] = False if jComments["saveAsmd5"] == '' else jComments["saveAsmd5"]
		# if True, the email ids in _data/comments/*.yml are saved as md5 hashes, useful if you make your _data/comments/*.yml public
		# otherwise emails are stored as it is
		# default: False
	except:
		print '\x1b[1;31;40m' + "Error in getting settings from _config.yml" + '\x1b[0m'
		return

	if settings["apiUrl"] == "":
		print '\x1b[1;31;40m' + "You must set your apiUrl first in settings." + '\x1b[0m'
		return

	settings["comment_counter"] =  0
	settings["files_updated"] = []
	settings["deleteKey"] = "123456789" if settings["deleteKey"] == "" else settings["deleteKey"]


	# BEGIN MAIN FUNCTION

	print "requesting comments from : ", settings["apiUrl"]
	r = requests.get(settings["apiUrl"] + "?mode=get", allow_redirects=True)
	comments = r.json()["pending"]
	total_comments = len(comments)


	print mdv.main('*' + str(total_comments) + '* **comments need to be moderated.**', theme='960.847')

	for comment in comments:
		settings["comment_counter"] += 1	
		slug = settings["commentsDir"] + unquote(comment["slug"]).decode('utf8') + ".yaml"
		try:
			f = open(slug, 'r')
		except IOError:
			f = open(slug, 'w')
			yaml.safe_dump({'comments': []}, f, default_flow_style=False, indent=2)
			f.close()
			f = open(slug, 'r')


		old_data = yaml.load(f)
		oldComments = old_data["comments"]
		
		comment_id = unquote(comment["id"]).decode('utf8')
		comment_content = unquote(comment["content"]).decode('utf8')
		comment_date = parse(unquote(comment["timestamp"]).decode('utf8'))
		comment_date = (comment_date - comment_date.utcoffset()).replace(tzinfo=None) # utc datetime
		comment_author = unquote(comment["author"]).decode('utf8')
		comment_email = unquote(comment["email"]).decode('utf8')
		comment_image = unquote(comment["image"]).decode('utf8')
		comment_url = unquote(comment["url"]).decode('utf8')
		
		comment_data = {
			"comment_id": comment_id,
			"comment_content": comment_content,
			"comment_date": comment_date,
			"comment_author": comment_author,
			"comment_email": comment_email,
			"comment_image": comment_image,
			"comment_url": comment_url,
			"comment_slug": unquote(comment["slug"]).decode('utf8')
		}

		oldIds = [x["id"] for x in oldComments]
		if comment_id == "c":
			new_comment_id = 1
			if oldIds != []:
				new_comment_id = max([int(x.split("c")[1]) for x in oldIds]) + 1  # calculated based on highest index in oldComments				
			newComment = newCommentBody(comment_data, 0, "c" + str(new_comment_id), settings)
			oldtimestamps = [x["date"] for x in oldComments] # used to skip comments with same timestamp
			if comment_date.isoformat() in oldtimestamps:
				print_error()
			else:
				printDetails(comment_data, 0)
				eval(moderateMsg(settings, comment_data, "oldComments.append(newComment)"))					
		else:			
			currentCId = oldIds.index(comment_id) # find parent comment id
			oldComment = oldComments[currentCId]
			if "replies" in oldComment:
				oldRIds = [int(x["id"].split("-")[1]) for x in oldComment["replies"]] 
				new_reply_id = max(oldRIds) + 1
				newReply  = newCommentBody(comment_data, 1, comment_id + "-" + str(new_reply_id), settings)
				oldtimestamps = [x["date"] for x in oldComment["replies"]]
				if comment_date.isoformat() in oldtimestamps:
					print_error()
				else:
					printDetails(comment_data, 1)
					eval(moderateMsg(settings, comment_data, 'oldComment["replies"].append(newReply)'))													
			else:
				oldComment["replies"] = []
				printDetails(comment_data, 1)
				newReply  = newCommentBody(comment_data, 1, comment_id + "-1", settings)
				eval(moderateMsg(settings, comment_data, 'oldComment["replies"].append(newReply)'))													

		f.close()
		old_data["updated"] = datetime.now().isoformat()
		old_data["count"] = {
			"comments": len(oldComments),
			"replies": sum([len(x["replies"]) for x in oldComments if "replies" in x])
		}

		f = open(slug, 'w')
		yaml.safe_dump(old_data, f, default_flow_style=False, indent=2)
		f.close()
		print


	settings["files_updated"] = list(set(settings["files_updated"]))
	num_files = len(settings["files_updated"])
	if num_files == 0:
		print mdv.main(("**No new comments were added.** *Nothing to do.*"), theme='960.847')
	else:
		print mdv.main("**Comments were added to " + str(num_files) + (" file" if num_files == 1 else " files") + " for publishing.** *Build site again and deploy to update comments on site.*", theme='960.847')
	with open(settings["logFile"], 'w') as f:
		f.writelines(settings["files_updated"])
	deletePending(settings, settings["comment_counter"])


def main():
	settings = {
		"deleteKey": "",
		# a key that is known only to you - this is the same key as in comments.gs file
		# allows: comment deletion, get comments, user blacklisting
		# keep it safe, don't add comments.gs and comments.py to your git repo
		# default: "123456789"
		"passAll": True if 'all' in cli_args[1:] else False
	}

	updateComments(settings)

if __name__ == '__main__':
	main()