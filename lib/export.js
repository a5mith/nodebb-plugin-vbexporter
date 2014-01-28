var async  = require('async'),
	mkdirp = require('mkdirp'),
	mysql  = require('mysql'),
	rimraf = require('rimraf');

var fs     = require('fs');

var forumFilterQuery = 'SELECT forumid as id ' +
	'FROM forum';

var threadFilterQuery = 'SELECT t.threadid as id ' +
	'FROM thread t ' +
	'JOIN post p ON t.firstpostid=p.postid ' +
	'WHERE t.forumid IN ';

var userFilterQuery = 'SELECT userid as id ' +
	'FROM post p ' +
	'WHERE threadid IN ';

var connection;
var threadFilter, forumFilter, userFilter;

function getFilter(query, next) {
	connection.query(query, {}, function(err, rows, fields) {
		if(err) { console.log(err); console.log(query); }
		var ids = [];
		rows.forEach(function(row) {
			ids.push(row.id);
		});
		next(null, '(' + ids.join(',') + ')');
	});
}

var withFilter;
exports.run = function(connectionParms, forums) {
	var outputDirName = 'storage';

	console.log('forums: ' + forums);
	withFilter = forums ? true : false;
	console.log(withFilter);
	if(forums) { forumFilterQuery += ' WHERE parentid IN (' + forums + ')'; }

	connection = mysql.createConnection(connectionParms);
	connection.connect(function(err) {
		// connected! (unless `err` is set)
		if(err) { throw 'db connection failed'; }
	});

	rimraf.sync(outputDirName, function(err) {
		if(err) { throw 'failed to remove directory "' + outputDirName + '"'; }
	});

	mkdirp(outputDirName, function(err) {
		if(err) { throw 'failed to create directory'; }
		process.chdir(outputDirName);

		async.auto({
				forumFilter:  async.apply(getFilter, forumFilterQuery),
				threadFilter: ['forumFilter', function(next, result) {
					if(!withFilter) { return next(); }
					threadFilterQuery = threadFilterQuery + result.forumFilter;
					getFilter(threadFilterQuery, next);
				}],
				userFilter:   ['threadFilter', function(next, result) {
					if(!withFilter) { return next(); }
					userFilterQuery = userFilterQuery + result.threadFilter;
					getFilter(userFilterQuery, next);
				}]
			}, function(err, result) {
				// console.log(result);

				threadFilter = result.threadFilter;
				forumFilter  = result.forumFilter;
				userFilter   = result.userFilter;

				dumpForums();
				dumpThreads();
				dumpPosts();
				dumpUsers();

				connection.end();
			});
	});
};

function dumpRecords(args) {
	console.log('dumpRecords: ' + JSON.stringify(args));
	var query       = args.query,
		keyField    = args.keyField,
		transformFn = args.transformFn,
		prefix      = args.idPrefix;
	connection.query(query, {}, function(err, rows, fields) {
		var ids = [];
		rows.forEach(function(row) {
			ids.push(row[keyField]);
			if(ids.length % 50 === 0) { console.log(prefix + 'ids: ' + ids.length); }

			var nodebbFormat = {
				normalized: transformFn(row),
				imported: null,
				skipped: null
			};
			fs.writeFileSync(prefix + '.' + row[keyField], JSON.stringify(nodebbFormat, null, 4) + '\n');
		});
		fs.writeFileSync('_' + prefix + 'ids.json', JSON.stringify(ids) + '\n');
	});
}

function dumpForums() {
	var count = 0;
	var forumQuery = 
		'SELECT forumid, title, description, displayorder ' +
		'FROM forum';
	withFilter && (forumQuery += ' WHERE forumid IN ' + forumFilter);
	dumpRecords({
		query:    forumQuery,
		keyField: 'forumid',
		idPrefix: 'c',
		transformFn: function(row) {
			return {
				_cid:         row.forumid,
				_name:        row.title,
				_description: row.description,
				_order:       row.displayorder
			};
		}
	});
}

function dumpThreads() {
	var count = 0;
	var threadQuery =
		'SELECT t.threadid, p.userid, t.forumid, p.title, p.pagetext, p.dateline, t.views, t.open, t.deletedcount, t.sticky ' +
		'FROM thread t ' +
		'JOIN post p ON t.firstpostid=p.postid';
	withFilter && (threadQuery += ' WHERE t.threadid IN ' + threadFilter);
	dumpRecords({
		query:       threadQuery,
		keyField:    'threadid',
		idPrefix:    't',
		transformFn: function(row) {
			return {
				_tid:       row.threadid,
				_uid:       row.userid,
				_cid:       row.forumid,
				_title:     row.title,
				_content:   row.pagetext,
				_timestamp: row.dateline * 1000, // convert seconds to millis
				_viewcount: row.views,
				_locked:    row.open ? 0 : 1, // open is the opposite of locked
				_deleted:   row.deletedcount,
				_pinned:    row.sticky
			};
		}
	});
}

function dumpPosts() {
	var count = 0;
	var postQuery =
		'SELECT postid, threadid, userid, pagetext, dateline ' +
		'FROM post p ' +
		'WHERE parentid<>0';
	withFilter && (postQuery += ' AND threadid IN ' + threadFilter);
	dumpRecords({
		query:       postQuery,
		keyField:    'postid',
		idPrefix:    'p',
		transformFn: function(row) {
			return {
				_pid:       row.postid,
				_tid:       row.threadid,
				_uid:       row.userid,
				_content:   row.pagetext,
				_timestamp: row.dateline * 1000 // convert seconds to millis
			};
		}
	});
}

function dumpUsers() {
	var count = 0;
	var userQuery =
		'SELECT u.userid, email, username, signatureparsed, joindate, homepage, profilevisits, birthday ' +
		'FROM user u ' +
		'LEFT JOIN sigparsed sp ON sp.userid=u.userid';
	withFilter && (userQuery += ' WHERE u.userid IN ' + userFilter);
	dumpRecords({
		query: userQuery,
		keyField: 'userid',
		idPrefix: 'u',
		transformFn: function(row) {
			return {
				_uid:                 row.userid,
				_email:               row.email,
				_username:            row.username,
				_alternativeUsername: "",
				_signature:           row.signatureparsed || "",
				_website:             row.homepage,
				_banned:              0,
				_location:            "",
				_joindate:            row.joindate * 1000, // convert seconds to millis
				_reputation:          0,
				_profileviews:        row.profilevisits,
				_birthday:            row.birthday,
				_showemail:           0,
				_level:               ""
			};
		}
	});
}
