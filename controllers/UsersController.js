import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const { ObjectId } = require('mongodb');
const Bull = require('bull');

class UsersController {
  static async postNew(request, response) {
    const userQueue = new Bull('userQueue');

    const userEmail = request.body.email;
    if (!userEmail)
      return response.status(400).send({ error: 'Missing email' });

    const userPassword = request.body.password;
    if (!userPassword)
      return response.status(400).send({ error: 'Missing password' });

    const oldUserEmail = await dbClient.db
      .collection('users')
      .findOne({ email: userEmail });
    if (oldUserEmail)
      return response.status(400).send({ error: 'Already exist' });

    const shaUserPassword = sha1(userPassword);
    const result = await dbClient.db
      .collection('users')
      .insertOne({ email: userEmail, password: shaUserPassword });

    userQueue.add({
      userId: result.insertedId,
    });

    return response
      .status(201)
      .send({ id: result.insertedId, email: userEmail });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const redisToken = await redisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });
    delete user.password;

    return res.status(200).send({ id: user._id, email: user.email });
  }
}

export default UsersController;
