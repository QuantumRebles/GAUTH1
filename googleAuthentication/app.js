
if(process.env.NODE_ENV != "production"){
  require('dotenv').config();
  console.log("nice");
  console.log(process.env.GOOGLE_CLIENT_ID);
}
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const path = require('path');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const passport = require('passport');
const localStratgey = require('passport-local');
const User = require("./models/user");
const flash = require('connect-flash');
const { access } = require('fs');
const googleStrategy = require('passport-google-oauth2').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

app.set("view engine", "ejs");
app.engine("ejs", ejsMate);
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));

// MongoDB connection
async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/GAUTH',{
    useNewUrlParser : true,
    useUnifiedTopology : true
  });

}
main().catch(err => console.log(err));

// Session & Passport configuration
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'MySecrete',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))

//passport uses the session here so we are writing the passport below the  session middlewaere
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStratgey(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(flash());
app.use((req,res,next)=>{
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  console.log(req.user);
  next();
})

passport.use(new googleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    
    // First, try to find by Google ID
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      return done(null, user); // Google account already linked
    }

    // If no Google ID found, check if there's a user with the same email (normal sign-up)
    user = await User.findOne({ email });

    if (user) {
      // Link Google ID to the existing user
      user.googleId = profile.id;
      await user.save();
      return done(null, user);
    }

    // Else, new user – create entry
    const newUser = new User({
      username: profile.displayName,
      email,
      googleId: profile.id,
    });

    await newUser.save();
    return done(null, newUser);

  } catch (err) {
    return done(err, null);
  }
}));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "/auth/github/callback"
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value || `${profile.username}@github.com`; // fallback
    let user = await User.findOne({ githubId: profile.id });

    if (user) {
      return done(null, user);
    }

    user = await User.findOne({ email });

    if (user) {
      user.githubId = profile.id;
      await user.save();
      return done(null, user);
    }

    const newUser = new User({
      username: profile.username,
      email,
      githubId: profile.id
    });

    await newUser.save();
    return done(null, newUser);
  } catch (err) {
    return done(err, null);
  }
}));



// Server listener
app.listen(8080, () => {
  console.log("hello ji");
});

// Routes
app.get('/', (req, res) => {
  res.render("home");
});

app.get('/signUp',(req,res)=>{
    
    res.render('index.ejs');
});

app.post('/signUp', async (req, res, next) => {
  try {
    const { username, password, email } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);
    req.logIn(registeredUser, (err) => {
      if (err) return next(err);
      res.redirect('/');
    });
  } catch (err) {
    res.send("Registration error: " + err.message);
  }
});


app.get("/log-in",(req,res)=>{
      res.render("log-in.ejs");
})


app.post("/log-in", passport.authenticate("local",{failureRedirect:'/log-in',failureFlash:true}) ,(req,res)=>{
   req.flash('sucess','welcome back!');
   res.redirect('/');
})

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/log-in', failureFlash: true }),
  (req, res) => {
    req.flash('success', 'Logged in with Google!');
    res.redirect('/');
});



app.get('/auth/github',
    passport.authenticate('github', { scope: ['user:email'] })
);
 

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/log-in', failureFlash: true }),
  (req, res) => {
    req.flash('success', 'Logged in with GitHub!');  
    res.redirect('/');
});

app.get('/log-out',(req,res,next)=>{
  req.logout((err)=>{
      if(err){
          return next(err);
      }
      req.flash("succes","logged  you out");
      res.redirect('/');
  })
})
  