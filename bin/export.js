var nconf = require('nconf')
	.argv()
	.env()
	.file({ file: __dirname + '/../config.json' })
	.defaults({
		host     : 'localhost',
		database : 'forum',
		user     : 'root',
		password : '',

		forums   : '1'
	});

console.log(nconf.get('forums'));

var connectionParms = {
	host:     nconf.get('host')     || nconf.get('h'),
	database: nconf.get('database') || nconf.get('d'),
	user:     nconf.get('user')     || nconf.get('u'),
	password: nconf.get('password') || nconf.get('p') || ''
};

var exportVB = require(__dirname + '/../lib/export.js');
exportVB.run(connectionParms, nconf.get('forums'));
