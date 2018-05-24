const express = require('express')
const ejs = require('ejs')
const Sequelize = require('sequelize')
const bodyParser = require('body-parser')
const PORT = process.env.PORT || 3000
const passport = require('passport')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const LocalStrategy = require('passport-local').Strategy
const SequelizeStore = require('connect-session-sequelize')(session.Store)

const Op = Sequelize.Op
const sequelize = new Sequelize('XXXXX', 'postgres', 'XXXXX', {
	host: 'localhost',
	port: '5432',
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


const sessionStore = new SequelizeStore({
    db: sequelize
  });

sequelize.sync()
sessionStore.sync();

const app = express()



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



//-------------Start of Passport Login-----------
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

// ====to 'add' images ============









// ====to 'delete' images ============








//===Server ============

app.listen(PORT, ()=>{
	console.log("Server is running...")
})
