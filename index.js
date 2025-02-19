import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "Books",
    password: "nati123mes",
    port: 5432
});

db.connect();

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.get("/", async(req, res)=>{

    const result = await db.query("SELECT * FROM notes");
    const data = result.rows;
    res.render("index.ejs", {posts: data});
});

app.get("/notes/:id", async(req, res)=>{
    const id = req.params.id;
    const foundPost = await db.query("SELECT intro, mynotes FROM notes WHERE id = $1", [id]);

    const postIntro = foundPost.rows[0].intro;
    const postNote = foundPost.rows[0].mynotes;
    const postTitle = foundPost.rows[0].title;

    res.render("note.ejs", {postIntro, postNote, postTitle});
});

// app.get("/new", (req, res)=>{
//     res.render("new.ejs", {editPost: null});
// });

// app.post("/submit", async(req, res)=>{
//     const newPost = 
// });

app.listen(port, ()=>{
    console.log(`Server running on port ${port}`)
});