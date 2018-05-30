// ==========Dependencies=========
const express = require('express')
const ejs = require('ejs')
const Sequelize = require('sequelize')
const bodyParser = require('body-parser')
const PORT = process.env.PORT || 3000
const passport = require('passport')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const sharp = require('sharp')
const path = require('path')
const multer = require('multer')
const LocalStrategy = require('passport-local').Strategy
const SequelizeStore = require('connect-session-sequelize')(session.Store)

// =======SQL shell login setup=========
const Op = Sequelize.Op
const sequelize = new Sequelize('instaphotos', 'postgres', 'giants', {
	host: 'localhost',
	port: '5433',
	dialect: 'postgres',
	operatorsAliases:{
		$and: Op.and,
		$or: Op.or,
		$eq: Op.eq,
		$like: Op.like,
		$iLike: Op.iLike
	}
})

const User = sequelize.define('user', {
	fname: Sequelize.STRING,
	lname: Sequelize.STRING,
	username: Sequelize.STRING,
	password: Sequelize.STRING,
	email: Sequelize.STRING
})

// =======Photo storage in SQL - Defining the Table=========
const Pic = sequelize.define('pic',{
    username: Sequelize.STRING,
    image: Sequelize.STRING,
    comment: Sequelize.STRING
})

const sessionStore = new SequelizeStore({
    db: sequelize
  });

sequelize.sync()
sessionStore.sync();




// ========Multer Photo Upload Storage Architecture==========
const storage = multer.diskStorage({
    destination: './public/uploads',
    filename: (req,file, cb)=>{
        // NAMING CONVENTION (make it unique)
        // tell it what to do to 
        // define and name the file
        cb(null, file.fieldname + '_'+Date.now()+path.extname(file.originalname))
    } 
});
// -Multer uploads to the uploads folder, Sharp uploads to the thumbnail folder
// Upload Process Definition so multer knows the name of the input type of file
const upload = multer({storage: storage}).single('image')
// MUST correspond with the HTML 'select file' input






// ======Boilerplate=============== 
const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:false}))
app.use(express.static('public'))



passport.serializeUser(function(user, done) {
		console.log("*********SerializeUser*********")
      done(null, user)
});
	passport.deserializeUser(function(obj,done){
		console.log("--deserializeUser--");
		console.log(obj)	
			done(null, obj);
	})



//================Start Passport Local Config==================
passport.use('local-signup', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, processSignupCallback));   

function processSignupCallback(req, username, password, done) {
    User.findOne({
        where: {
            'username' :  username
				}
    })
    .then((user)=> {
        if (user) {
            return done(null, false);
        } else {

			let newUser = req.body; 
			User.create(newUser)
			.then((user)=>{
			   console.log("Yay!!! User created")
			    return done(null, user);
			})

		}	 
	})
}



//==============Start of Passport Logi==========
passport.use('local-login', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, processLoginCallback));   

function processLoginCallback(req, username, password, done) {
    User.findOne({
        where: {
            'username' :  username
				},
    })
    .then((user)=> {
        if (!user) {
            return done(null, false);
        }else if(password !== user.password){
						return done(null, false)
					}else{
			   console.log("Yay!!! User is logged in")

			    return done(null, user);
			  }
		})

}	 


  app.use(require('morgan')('combined'));
	app.set('view engine', 'ejs')
	app.use(bodyParser.json())
	app.use(bodyParser.urlencoded({ extended: true }));
	app.use(express.static('public'))
	app.use(cookieParser());

	app.use(session({ 
		secret: 'keyboard cat', 
		store: sessionStore,
		resave: false, 
		saveUninitialized: false 
	}));

//================ Passport Middleware ==============

app.use(passport.initialize());
 app.use(passport.session());



//=========Routes==================
app.get('/', (req, res)=>{
	if(req.user){
	res.render('homepage', {user: req.user})
	}else{
		res.redirect('/login')
	}
})

app.get('/register', (req, res)=>{
	return res.render('register')
})

app.post('/signup', function(req,res, next){
	passport.authenticate('local-signup', function(err, user){
		if (err) {
			return next(err);
		} else {
			return res.redirect('/login')
		}
	})(req, res, next);
});

app.post('/login', function(req,res,next){
		passport.authenticate('local-login', function(err, user){
			console.log("Another login for user  :" + req.user)
			if (err || user == false) {
				return res.render('login', {message: "Incorrect Username/Password"})
			} else {
				req.login(user, function(err){
					console.log("Getting req.user :"+ req.user)
					return res.render('homepage', {user: req.user})
				})
			}
		})(req, res, next);
})


app.get('/login', (req, res)=>{
	return res.render('login', {message: "Please login"})
})

app.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res){
  	console.log("****The req.user****" + req.user)
  	User.findById(req.user.id).then((user)=>{
     res.render('profile', { user: user.dataValues});
    })
  })

app.get('/logout',function(req, res){
  	console.log("*****Loging out*****")
  	req.session.destroy()
    req.logout();
    res.redirect('/login');
  })




// ====to 'add' images(via post method in multer) ============
app.post('/upload', (req,res)=>{
    upload(req,res, (err)=>{
        if(err){
            console.log(err)
        }
    console.log(req.body)
    console.log(req.file)
    console.log("File for sharp "+ req.file.path)
    // Sharp will customize...create thumbnails
    sharp(req.file.path)
        .resize(100,100)
        // indicate where files will be stored
        .toFile('public/thumbnails/'+req.file.filename, function(err){
            // res.send(req.file)
            // ^^^ that sends it to the browser
        })
        // create function to enter records into sequelize
        // from upload (above), we're getting this data
        Pic.create({
            username: req.body.username,
            image: req.file.filename,
            comment: req.body.comment
        })
        .then(()=>{
            return res.redirect('/')
        })
    })    
})

// ====to 'delete' images ============




//======== Read Files and Render them in EJS ==========

app.get('/', (req,res)=>{
	//    'find all' is like a select all query in SQL
	// we get data as rows, and use .then to send it to
	// livegram.ejs file
		Pic.findAll().then((rows)=>{
			return rows
		})
		.then((rows)=>{
			//  we send it to the ejs file name
			return res.render('profile',{rows})
			// outputing 'data' from read directory to gallery
		})
	})
	
	app.post('/',(req,res)=>{
		fs.readdir()
	})




//===Server ============

app.listen(PORT, ()=>{
	console.log("Server is running...")
})
