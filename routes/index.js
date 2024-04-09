import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';

function controllerRouting(app) {
  const router = express.Router();
  app.use('/', router);

  // controler App
  router.get('/status', (req, res) => {
    AppController.getStatus(req, res);
  });

  router.get('/stats', (req, res) => {
    AppController.getStats(req, res);
  });

  // controler user
  router.post('/users', (req, res) => {
    UsersController.postNew(req, res);
  });
}

export default controllerRouting;
