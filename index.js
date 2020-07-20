// import modules
const path = require("path"),
      http = require('http'),
      express =  require('express'),
      socketIo = require('socket.io'),
      mime =  require('mime'),
      bodyparser = require('body-parser'),
      database = require('node-couchdb'),
      multer = require('multer'),
      session =require('express-session'),
      joi = require('@hapi/joi'),
      app = express(),
      server = http.createServer(app),
      io = socketIo(server),
      port = process.env.PORT | 3000,
//database connection     
      couchdb = new database(),
      users = {},
	  dbName = "chatdatastore",
      dbName2 = "messages",
      viewUrl = "_design/all_users/_view/all",
      viewUrl2 = "_design/messages/_view/new";
//session variable      
var sess;

//middlewares
app.use(express.static(path.join(__dirname,'public')));
app.set('view engine','ejs');
app.use(bodyparser.urlencoded({extended:false}));
app.use(session({secret:'keepsecrets', resave:true, saveUninitialized:true,cookie:{secure:true}}))
app.use(bodyparser.json({limit: '50mb'}));

// declaring image destination and path
var storage = multer.diskStorage({
	destination: './public/images/',
	filename: function(req, file, cb){
		cb(null, file.fieldname+ Date.now()+path.extname(file.originalname))
	}
});
//ends 

// checking type of an image and its size
const upload = multer({
	storage: storage,
	limits: {fileSize: 10000000},
	fileFilter: function(req, file, cb){
		checkFileType(file, cb);
	}
}).single('image');
//ends

function checkFileType(file, cb){
	const filetypes = /jpeg|jpg|png|/;
	const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
	const mimetype =filetypes.test(file.mimetype);

	if(mimetype && extname){
		return cb(null, true);
	}else{
		cb('Error: Images');
	}
}

function insertIntodatabase(name, email, password, gender, pics){
	couchdb.uniqid().then((ids)=>{
		const id = ids[0];

		couchdb.insert(dbName, {
			name:name,
			email:email,
			password:password,
			gender:gender,
			pics:pics
		}).then((data, headers, status)=>{
			console.log(data);
		},(err)=>{
			res.send(err);
		});
	});
}

// client-server communication
io.on('connection', socket =>{
	socket.on('user', name=>{
		users[socket.id] = name;
		socket.broadcast.emit('user-connected',name);
	});

	socket.on('message from client', (data)=>{
		io.emit('broadcast messages to client',{
			message: data, 
			name:users[socket.id]
		});
	});

	socket.on('sender', (data)=>{
		socket.emit('reciever', data.mess);
		couchdb.uniqid().then((ids)=>{
			const id = ids[0];
			couchdb.insert(dbName2, {
				sender:data.sender,
				message:data.mess,
				time:data.time,
				timetracker:data.timetracker
			}).then((data, headers, status)=>{
				console.log(data);
			},(err)=>{
				res.send(err);
			});
	    });
	});
});
// ends

app.get('/', (req,res)=>{ 
	var data = req.query.invalid;
	if(typeof(data) === 'undefined'){
		res.render('home'); 
	}else{
		res.render('home',{mess:data});
	}
	req.session.destroy();		
	sess = null;
});

app.get('/chatapp',(req,res)=>{
    if(typeof(sess) === 'undefined' || sess === null){
   		res.redirect('/?invalid='+'Log-in your credentials');
    }else{
    	couchdb.get(dbName, viewUrl).then((data, headers, status)=>{
    		let result = req.query.user;
            var users = [];
			var results = data.data.rows;
			var num = data.data.total_rows;

			for(var i = 0; i < num; i++){
				if(result !== results[i].value.email){
					if(results[i].value.email !== undefined){
						var name = results[i].value.name,
						    email = results[i].value.email,
						    gender = results[i].value.gender,
						    pics = results[i].value.pics;

						// filtering other users' data into array
						users[i] = {
							Name:name,
							Email:email,
							Gender:gender,
							Pics:pics,
						}
				    }
				}if(result === results[i].value.email){
					// filtering main user data
			   		sess.name = results[i].value.name;
			   		sess.email = result;
			   		sess.gender = results[i].value.gender;
			   		sess.password = results[i].value.password;
			   		sess.pics = results[i].value.pics;
			   		sess._id = results[i].key;
			   		sess._rev = results[i].value.rev;
			    }
			}
		
			couchdb.get(dbName2, viewUrl2).then((data, headers, status)=>{
				var message = data.data.rows;
				var num = data.data.total_rows;
				for(var i = 0; i < users.length; i++){
					if(users[i] !== undefined){
						const sender = sess.email+"%"+users[i].Email;
						const receiver = users[i].Email+"%"+sess.email;
						let S_time = 0;
						let R_time = 0;
	                    /*
	                    tracking down users if there are unreplied messages
	                    */
						for(var x = 0; x < num; x++){
							if(message[x].value.sender === sender){
								if(message[x].value.timetracker > S_time){
								    S_time = message[x].value.timetracker;
								}
							}else if(message[x].value.sender === receiver){
								if(message[x].value.timetracker > R_time){
								    R_time = message[x].value.timetracker;
								}
							}
						}
						if(R_time > S_time){
							users[i].status = "active"; 
							//active means there are(is an) unreplied message(s)
						}else{
							users[i].status = "passive";
							//passive means otherwise
						}
				    }
			    }
			    res.render('chat',{sess, users});
			},(err)=>{
				res.send(error);
			});
		},(err)=>{
			res.send(error);
	    });
    }
});

app.get('/chatappmessages', (req,res)=>{ 
	var sender = req.query.user;
	var users = sender.substring(sender.indexOf('%')+1,sender.length);
	var send = sender.substring(0,sender.indexOf('%'));
	var receiver = users+"%"+send;
	let rsmessage = [];
	var rsmessage2 = [];
	var user={};

	couchdb.get(dbName2, viewUrl2).then((data, headers, status)=>{
		let message = data.data.rows;
		let num = data.data.total_rows;

		// seperating messages sent by the sender and the receiver
		for(var i = 0; i < num; i++){
	   		if(message[i].value.sender === sender){
	   			mes = {
	   				message: message[i].value.message,
	   				time: message[i].value.time,
	   				tracker: message[i].value.timetracker,
	   				status: "sent"
	   			}
	   			rsmessage[i] = mes;
	   		}

	   		if(message[i].value.sender === receiver){
	   			rec = {
	   				message: message[i].value.message,
	   				time: message[i].value.time,
	   				tracker: message[i].value.timetracker,
	   				status: "recieved"
	   			}
	   			rsmessage[i] = rec;
	   		}
		}
		
		// filter non-empty objects from array of rsmessage
		rsmessage = rsmessage.filter((c)=>{
			return c != undefined;
		});
		//end

		/*ordering messsages in the other of which 
		  they are sent using the time tracker*/
		for(var i = 0; i < rsmessage.length-1; i++){
			for(var j = 0; j < rsmessage.length-1; j++){
				if(i<=j){
					if(rsmessage[i].tracker > rsmessage[j+1].tracker){
						rsmessage2[i] = rsmessage[i];
						rsmessage[i] = rsmessage[j+1];
						rsmessage[j+1] = rsmessage2[i];
					}
				}
			}
		}
		//end

		couchdb.get(dbName, viewUrl).then((data, headers, status)=>{

			let results = data.data.rows;
			let number = data.data.total_rows;
		    
		    //receiver data(user)
			for(var i = 0; i < number; i++){
			   if(users === results[i].value.email){
			   		user.name = results[i].value.name;
			   		user.email = users;
			   		user.gender = results[i].value.gender;
			   		user.pics = results[i].value.pics;
			   }
			}
		    res.render('message',{sess, rsmessage, user});
		},(err)=>{
			res.send(error);
		});
	},(err)=>{
		res.send(error);
	});
});

app.get('/chatappimage', (req,res)=>{ 
	res.render('checkImages',{sess}); 
});

app.get('/nodecomunity', (req,res)=>{ 
	res.render('node',{sess}); 
});

app.get('/usersimages', (req,res)=>{
	let userdata = req.query.data;
	var usermail = sess.email;

	couchdb.get(dbName, viewUrl).then((data, headers, status)=>{

		var results = data.data.rows;
		var num = data.data.total_rows;
		var num_rows_affected = 0;
		var data = req.query.user;
	    var user={};

		for(var i = 0; i < num; i++){
		   if(userdata === results[i].value.email){
		   		user.name = results[i].value.name;
		   		user.email = userdata;
		   		user.gender = results[i].value.gender;
		   		user.pics = results[i].value.pics;
		   }
		}
		res.render('checkImages',{user, usermail});
	},(err)=>{
		res.send(error);
	}); 
});

app.post('/chatapp', (req, res)=>{ 
	couchdb.get(dbName, viewUrl).then((data, headers, status)=>{

		var results = data.data.rows;
		var num = data.data.total_rows;
		var num_rows_affected = 0;

		// validating email and password for login
		for(var i = 0; i < num; i++){
		   if(req.body.email === results[i].value.email && 
		   	  req.body.password === results[i].value.password){
		   		num_rows_affected += 1;
		   }
		}
		//if email and password correct, create a session else redirect back
		if(num_rows_affected>0){
			sess = req.session;
			sess.auth = 'validated';
		    let data = req.body.email;
			res.redirect('/chatapp?user='+data);
		}else{
			res.redirect('/?invalid='+'Wrong Email or password');
		}
	},(err)=>{
		res.send(error);
	});
});

app.post('/', (req, res)=>{ 
	//validating registered user's data
	const schema = joi.object().keys({
		name: joi.string().trim().required(),
		email: joi.string().trim().email().required(),
		password: joi.string().required(),
		gender:joi.required()
	});

	v = schema.validate(req.body);
	//if no error with data get user's data into the database
	if(v.error.details[0].path[0] == 'submit'){
		let name = v.value.name,
		email = v.value.email,
		password =  v.value.password,
		gender = v.value.gender;
		insertIntodatabase(name, email, password, gender, "none");
		res.render('home',{message:"Successful registration..."});
	}else{
		res.render('home',{message:"Fields cannot be empty!!!"});
	} 
});

app.post('/uploadimage', (req,res)=>{
	upload(req, res, (err)=>{
		if(err){
			res.render('checkImages',{message : "error while uploading", sess});
		}else{
			if(req.file == undefined){
				res.render('checkImages',{message : "no file selected", sess});
			}else{
				res.render('checkImages',{message : "picture succesfully uploaded",sess});
				couchdb.update(dbName,{
					_id:sess._id,
					_rev:sess._rev,
					name:sess.name,
					email:sess.email,
					password:sess.password,
					gender:sess.gender,
					password:sess.password,
					pics:req.file.filename
				}).then((data, headers, status)=>{
			        console.log(data);
		        },(err)=>{
					res.send(err);
		        });
			}
		}
	});
});

app.get('/delete', (req , res)=>{
	var sender = req.query.all;
	var users = sender.substring(sender.indexOf('%')+1,sender.length);
	var send = sender.substring(0,sender.indexOf('%'));
	var receiver = users+"%"+send;
	// delete sender and receiver related messages
	couchdb.get(dbName2, viewUrl2).then((data, headers, status)=>{
		let message = data.data.rows;
		let num = data.data.total_rows;

		for(var i = 0; i < num; i++){
	   		if(message[i].value.sender === sender 
	   			|| message[i].value.sender === receiver){
	   			const rev = message[i].value.rev;
	   			const id = message[i].key;

	   			couchdb.del(dbName2,id,rev).then((data, headers, status)=>{
				},(err)=>{
					res.send(err);
				});
	   		}
		}	
		res.redirect(`/chatappmessages?user=${sender}`);
	},(err)=>{
		res.send(error);
	});
});

server.listen(port, (err, success)=>{
	if(err) console.log('error connection');
	else console.log(`subscriber connected to ${port}`);
});