import express from "express";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import jwt from "jsonwebtoken";

const router = express.Router();

export default function setupAuthRoutes(db, JWT_SECRET, SESSION_SECRET) {

    passport.use(new LocalStrategy(async function verify(username, password, cb) {
        try {
            const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
            if (result.rows.length === 0) {
                return cb(null, false, { message: "Incorrect username or password." });
            }

            const user = result.rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return cb(null, false, { message: "Incorrect username or password." });
            }

            return cb(null, user);
        } catch (err) {
            return cb(err);
        }
    }));

    passport.serializeUser((user, cb) => {
        cb(null, user.id);
    });

    passport.deserializeUser(async (id, cb) => {
        try {
            const result = await db.query("SELECT id, username FROM users WHERE id = $1", [id]);
            if (result.rows.length === 0) {
                return cb(new Error("User not found"));
            }
            cb(null, result.rows[0]);
        } catch (err) {
            cb(err);
        }
    });

    router.get("/login", (req, res) => {
        res.render("login.ejs");
    });

    router.post("/login", passport.authenticate("local", {
        failureRedirect: "/login",
        failureFlash: true
    }), (req, res) => {
        const token = jwt.sign({ id: req.user.id, username: req.user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        res.redirect("/");
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

            req.login(newUser.rows[0], (err) => {
                if (err) {
                    console.error("Error auto-logging in after signup:", err);
                    return res.redirect("/login");
                }
                const token = jwt.sign({ id: newUser.rows[0].id, username: newUser.rows[0].username }, JWT_SECRET, { expiresIn: '1h' });
                res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
                res.redirect("/");
            });

        } catch (err) {
            console.error("Error during signup:", err);
            res.status(500).send("Error signing up.");
        }
    });

    router.get("/logout", (req, res) => {
        req.logout((err) => {
            if (err) {
                console.error("Error logging out:", err);
                return res.status(500).send("Error logging out.");
            }
            res.clearCookie('token');
            res.redirect("/login");
        });
    });

    return router;
}

export const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect("/login");
    }

    jwt.verify(token, process.env.JWT_SECRET || "aVeryStrongAndRandomJWTSecretKeyPleaseChangeThisInEnv", (err, user) => {
        if (err) {
            res.clearCookie('token');
            return res.redirect("/login");
        }
        req.user = user;
        next();
    });
};