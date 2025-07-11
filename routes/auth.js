import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = express.Router();

export default function setupAuthRoutes(db, JWT_SECRET) {

    router.get("/login", (req, res) => {
        res.render("login.ejs");
    });

    router.post("/login", async (req, res) => {
        const { username, password } = req.body;
        try {
            const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
            if (result.rows.length === 0) {
                return res.render("login.ejs", { error: "Incorrect username or password." });
            }

            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.render("login.ejs", { error: "Incorrect username or password." });
            }

            const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 });
            res.redirect("/");

        } catch (err) {
            console.error("login error: ", err);
            res.status(500).send("Login Error");
        }
    });

    router.get("/signup", (req, res) => {
        res.render("signup.ejs");
    });

    router.post("/signup", async (req, res) => {
        const { username, password } = req.body;
        try {
            const checkUser = await db.query("SELECT * FROM users WHERE username = $1", [username]);
            if (checkUser.rows.length > 0) {
                return res.render("signup.ejs", { error: "Username already exists. Try logging in." });
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = await db.query(
                "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username",
                [username, hashedPassword]
            );

            const token = jwt.sign({ id: newUser.rows[0].id, username: newUser.rows[0].username }, JWT_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 3600000 });
            res.redirect("/");

        } catch (err) {
            console.error("signup error: ", err);
            res.status(500).send("SignUp Error");
        }
    });

    router.get("/logout", (req, res) => {
        res.clearCookie('token');
        res.redirect("/login");
    });

    return router;
}

export const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;

    if (!token && req.path !== '/login' && req.path !== '/signup') {
        return res.redirect("/login");
    }

    if (!token) {
        return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('token');
            return res.redirect("/login");
        }
        req.user = user;
        next();
    });
};