import express, { type Request, type Response } from 'express';

import * as z from 'zod';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Server running!' });
});

app.listen(PORT, () => {
  console.log(`Server running at :${PORT}`);
});
