import express from 'express';
import controllerRouting from './routes/index';

const app = express();
const port = process.env.Port || 5000;

app.use(express.json());

controllerRouting(app);

app.listen(port, () => {
  console.log(`server running on ${port}`);
});

export default app;
