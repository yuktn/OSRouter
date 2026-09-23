import type { NextFunction, Request, Response} from "express";

const API_KEY = process.env.OSROUTER_API_KEY

export function auth(req: Request, res: Response, next: NextFunction) {

    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({error: "Auth failed."})

    if (!(authHeader === `Bearer ${API_KEY}`)) return res.status(401).json({error: "Auth failed."})

    next();
}