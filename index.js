import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

//TODO: geolocation API first 
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

//List containing all of the posts created.
var postList = [];

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));

// Fetch geolocation data
const location = await axios.get(GEOLOCATION_API_URL);

// Fetch weather / Temperature data
const result = await axios.get(API_URL + "q="+location.data.city+"&units=metric&appid=b0e987f4221739548c7feb541c0ce18a");

app.get("/", async (req, res) => {
  res.render("index.ejs", {
    list:postList,
    weather: result.data.weather[0].main,
    city: result.data.name,
    temp: result.data.main.temp,
    icon: result.data.weather[0].icon
  });
});

//Features : post creation, post viewing, post update/delete, styling
//POST CREATION
app.get("/create", (req, res) => {
  res.render("create.ejs", {
    weather: result.data.weather[0].main,
    city: result.data.name,
    temp: result.data.main.temp,
    icon: result.data.weather[0].icon
  });
});

app.get("/posts", (req, res) => {
  res.render("posts.ejs", {
    list:postList,
    weather: result.data.weather[0].main,
    city: result.data.name,
    temp: result.data.main.temp,
    icon: result.data.weather[0].icon
  });
});

app.post("/submit", (req, res) => {
  var blogPost = new BlogPost(req.body["title"], req.body["content"], new Date(), result.data.name);
  postList.push(blogPost);
  console.log(blogPost);
  console.log(postList);
  res.render("posts.ejs", {
    list:postList,
    weather: result.data.weather[0].main,
    city: result.data.name,
    temp: result.data.main.temp,
    icon: result.data.weather[0].icon
  });
})

//POST EDITING
app.get("/edit/:index", (req,res) => {
  const index = req.params.index;
  res.render("edit.ejs", {
    post: postList[index],
    index: index,
    weather: result.data.weather[0].main,
    city: result.data.name,
    temp: result.data.main.temp,
    icon: result.data.weather[0].icon
  });
})

app.post("/edit_post", (req,res) => {
  const index = req.body.index;
  const updatedPost = new BlogPost(req.body["title"], req.body["content"], new Date(), result.data.name);
  postList[index] = updatedPost;
  res.redirect("/posts");
})

//POST DELETION
app.post("/delete/:index", (req,res) => {
  const index = req.params.index;
  if (postList.length > 1) {
    postList.splice(index, 1);
  } else {
    postList.pop();
  }
  res.redirect("/posts");
})

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
