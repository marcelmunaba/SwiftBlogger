import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import session from "express-session";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";

const app = express();
const port = 3000;
const saltRounds = 10;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
env.config();

app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
      // cookie: {
      //   //maxAge in ms
      //   maxAge: 1000 * 60 * 60 * 24
      // }
    })
);

//AUTHENTICATION - USE LOCAL STRATEGY
app.use(passport.initialize());
app.use(passport.session());

//DATABASE SETUP
const db = new pg.Client({
  type: "postgres",
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

db.connect();

//Geolocation API
const GEOLOCATION_API_URL = "http://ip-api.com/json";
//Weather data fetch
var API_URL = "https://api.openweathermap.org/data/2.5/weather?";
//Post Object
function BlogPost (title, content, date, city) {
  this.title = title;
  this.content = content;
  this.date = date;
  this.city = city;
}

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));

// Fetch geolocation data
const location = await axios.get(GEOLOCATION_API_URL);

// Fetch weather / Temperature data
const weatherResult = await axios.get(API_URL + "q="+location.data.city+"&units=metric&appid=b0e987f4221739548c7feb541c0ce18a");

var err_msg = false; //Account creation error flag

app.get("/", async (req, res) => {
  res.render("home.ejs");
});


//LOGIN ROUTES
app.get("/login", (req, res) => {
  res.render("login.ejs", {
    errMsg: err_msg
  });
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.post(
    "/login",
    passport.authenticate("local", {
      successRedirect: "/index",
      failureRedirect: "/login",
    })
);

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  console.log(req.body);
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    console.log(checkResult.rows);
    if (checkResult.rows.length > 0) {
      res.redirect("/login");
      err_msg = true;
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
              "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
              [email, hash]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/index");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.get("/index", async (req, res) => {
  err_msg = false; //reset create account flag back to false
  if (req.isAuthenticated()) {
    const result = await db.query("SELECT COUNT(*) FROM blogs WHERE user_id = $1", [req.user.id]);
    var posts = [];
    if (result.rows[0].count > 0) {
      posts = await db.query("SELECT * FROM blogs WHERE user_id = $1", [req.user.id]);
    }
    var username = req.user.email;
    try {
      res.render("index.ejs", {
        username: username.split("@")[0],
        list: posts.rows,
        weather: weatherResult.data.weather[0].main,
        city: weatherResult.data.name,
        temp: weatherResult.data.main.temp,
        icon: weatherResult.data.weather[0].icon,
        postCount: result.rows[0].count
      });
    } catch (e) {
      console.log(e);
    }
  } else {
    res.redirect("/");
  }
});

//POST CREATION
app.get("/create", (req, res) => {
  res.render("create.ejs", {
    weather: weatherResult.data.weather[0].main,
    city: weatherResult.data.name,
    temp: weatherResult.data.main.temp,
    icon: weatherResult.data.weather[0].icon
  });
});

app.get("/posts", async (req, res) => {
  err_msg = false; //reset create account flag back to false
  if (req.isAuthenticated()) {
    try {
      const result = await db.query("SELECT * FROM blogs WHERE user_id = $1", [req.user.id]);
      console.log(result.rows);
      res.render("posts.ejs", {
        list:result.rows,
        weather: weatherResult.data.weather[0].main,
        city: weatherResult.data.name,
        temp: weatherResult.data.main.temp,
        icon: weatherResult.data.weather[0].icon
      });
    } catch (e) {
      console.log(e);
    }
  } else {
    res.redirect("/");
  }
});

app.post("/submit", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const userId = req.user.id;

      // Get the next available user-specific post ID
      const userPostIdQuery = await db.query("SELECT COALESCE(MAX(user_post_id), 0) + 1 AS next_user_post_id FROM blogs WHERE user_id = $1", [userId]);
      const nextUserPostId = userPostIdQuery.rows[0].next_user_post_id;

      var blogPost = new BlogPost(req.body["title"], req.body["content"], new Date(), weatherResult.data.name);

      // Insert the post with the determined user-specific post ID
      await db.query("INSERT INTO blogs (user_id, user_post_id, title, content, date_column, location) VALUES ($1, $2, $3, $4, $5, $6)", [userId, nextUserPostId, blogPost.title, blogPost.content, blogPost.date, blogPost.city]);

      res.redirect("/posts");
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).send("Error creating post");
    }
  } else {
    res.redirect("/");
  }
});

//POST EDITING
app.get("/edit/:index", async (req,res) => {
  if (req.isAuthenticated()) {
    const userId = req.user.id;
    const userPostId = req.params.index;
    const result = await db.query("SELECT * FROM blogs WHERE user_id = $1 and user_post_id = $2", [userId, userPostId]);
    console.log(result.rows);
    res.render("edit.ejs", {
      post: result.rows[0],
      index: 0,
      weather: weatherResult.data.weather[0].main,
      city: weatherResult.data.name,
      temp: weatherResult.data.main.temp,
      icon: weatherResult.data.weather[0].icon
    });
  } else {
    res.redirect("/");
  }
})

app.post("/edit_post", async (req,res) => {
  if (req.isAuthenticated()) {
    const index = req.body.index;
    const updatedPost = new BlogPost(req.body["title"], req.body["content"], new Date(), weatherResult.data.name);
    await db.query("UPDATE blogs SET title = $1, content = $2, date_column = $3, location = $4 WHERE user_id = $5",[updatedPost.title,updatedPost.content,updatedPost.date,updatedPost.city,req.user.id])
    res.redirect("/posts");
  } else {
    res.redirect("/");
  }

})

//POST DELETION
app.post("/delete/:index", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const userId = req.user.id;
      const userPostId = req.params.index; // Use the user_post_id from the URL parameter

      // Delete the post with the specified user-specific post ID
      await db.query("DELETE FROM blogs WHERE user_id = $1 AND user_post_id = $2", [userId, userPostId]);

      res.redirect("/posts");
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).send("Error deleting post");
    }
  } else {
    res.redirect("/");
  }
});

//LOCAL AUTH STRATEGY
passport.use(
    "local",
    new Strategy(async function verify(username, password, cb) {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
          username,
        ]);
        if (result.rows.length > 0) {
          const user = result.rows[0];
          const storedHashedPassword = user.password;
          bcrypt.compare(password, storedHashedPassword, (err, valid) => {
            if (err) {
              console.error("Error comparing passwords:", err);
              return cb(err);
            } else {
              if (valid) {
                return cb(null, user);
              } else {
                return cb(null, false);
              }
            }
          });
        } else {
          return cb("User not found. Please register at : /register");
        }
      } catch (err) {
        console.log(err);
      }
    })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
