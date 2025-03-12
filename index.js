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
    const id = parseInt(req.params.id);
    const foundPost = await db.query("SELECT * FROM notes WHERE id = $1", [id]);
    const post = foundPost.rows[0];

    res.render("note.ejs", {post});
});

app.get("/new", (req, res)=>{
    res.render("new.ejs", {editPost: null});
});

app.post("/submit", async(req, res)=>{

    const {title, rating, intro, note} = req.body;
    const date = new Date();
    const newDate = date.toDateString()

    await db.query("INSERT INTO notes(title, date, rating, intro, mynotes) VALUES($1, $2, $3, $4, $5)", [title, newDate, rating, intro, note]);

    res.redirect("/");
});

app.get("/edit/:id", async(req, res)=>{
    console.log(req.params.id);

    const result = await db.query("SELECT * FROM notes WHERE id=$1", [req.params.id]);
    const data = result.rows[0];

    res.render("new.ejs", {editPost: data});
});

app.post("/update/:id", async(req,res)=>{
    const id = parseInt(req.params.id);

    const {title, date, rating, intro, note} = req.body;

    try{
        const result = await db.query("UPDATE notes SET title=$1, date=$2, rating=$3, intro=$4, notes=$5, WHERE id=$6", [title, date, rating, intro, note, id]);
        console.log(result.rows[0]);
    
        res.redirect("/");
    }catch(err){
        console.log(err);
    }
});

app.listen(port, ()=>{
    console.log(`Server running on port ${port}`)
});