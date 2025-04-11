import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import env from "dotenv";

env.config();

const app = express();
const port = process.env.PORT;

const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.get("/", async(req, res)=>{

    const result = await db.query("SELECT * FROM notes");
    const data = result.rows;
    res.render("index.ejs", {posts: data});
});

app.get("/notes/:id", async(req, res)=>{
    const foundPost = await db.query("SELECT * FROM notes WHERE id = $1", [req.params.id]);
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
    const id = parseInt(req.params.id);
    const result = await db.query("SELECT * FROM notes WHERE id=$1", [id]);
    const data = result.rows[0];

    res.render("new.ejs", {editPost: data});
});

app.get("/delete/:id", async (req, res) => {
    try {
        const result = await db.query("DELETE FROM notes WHERE id = $1", [req.params.id]);
        
        if (result.rowCount === 0) {
            return res.status(404).send("Note not found");
        }

        res.redirect("/");
    } catch (err) {
        console.error(err);
    }
});

app.post("/update/:id", async(req,res)=>{
    const id = parseInt(req.params.id);

    const {title, rating, intro, note} = req.body;
    const date = new Date();
    const newDate = date.toDateString();

    try{
        const result = await db.query("UPDATE notes SET title=$1, rating=$2, intro=$3, mynotes=$4, date=$5 WHERE id=$6", [title, rating, intro, note, newDate, id]);
        console.log(result.rowCount);
    
        res.redirect("/");
    }catch(err){
        console.log(err);
    }
});

app.listen(port, ()=>{
    console.log(`Server running on port ${port}`)
});