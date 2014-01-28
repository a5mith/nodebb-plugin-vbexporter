nodebb-plugin-vbexporter
========================

A NodeBB plugin that exports vBulletin data to a format NodeBB importer can use.

Dump vBulletin forums, threads, posts, and users into a file/directory format
compatible with [nodebb-plugin-import](https://github.com/akhoury/nodebb-plugin-import)

This exporter connects to a MySQL database and exports a very basic version of the
vBulletin data schema.  Configuration options can be passed via config.json in the
plugin root directory, or via the command-line.

Available options are:

--host

	Hoststring to connect to the MySQL database - defaults to localhost

--database

	Name of the database to dump - defaults to "forum"

--user

	MySQL user to connect as - defaults to "root"

--password

	Password to connect to the database - defaults to ""

--forums

	Accepts a comma separated list of top level forum id's to filter on.  The export
	will dump one level of sub-forums, all the threads and posts within those forums,
	and any users associated with that total subset of posts.
