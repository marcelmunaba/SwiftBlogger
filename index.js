import express from "express";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

//Post Object
function BlogPost (title, content, date) {
  this.title = title;
  this.content = content;
  this.date = date;
}

//List containing all of the posts created.
var postList = [];

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index.ejs", {
    list:postList
  });
});

//Features : post creation, post viewing, post update/delete, styling
//POST CREATION
app.get("/create", (req, res) => {
  res.render("create.ejs");
});

app.get("/posts", (req, res) => {
  res.render("posts.ejs", {
    list:postList
  });
});

app.post("/submit", (req, res) => {
  var blogPost = new BlogPost(req.body["title"], req.body["content"], new Date());
  postList.push(blogPost);
  console.log(blogPost);
  console.log(postList);
  res.render("posts.ejs", {
    list:postList
  });
})

//POST EDITING
app.get("/edit/:index", (req,res) => {
  const index = req.params.index;
  res.render("edit.ejs", {
    post: postList[index],
    index: index
  });
})

app.post("/edit_post", (req,res) => {
  const index = req.body.index;
  const updatedPost = new BlogPost(req.body["title"], req.body["content"], new Date());
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
