import { ObjectId } from 'mongodb';
import RedisClient from '../utils/redis';
import DBClient from '../utils/db';

class UsersController {
  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db
      .collection('users')
      .findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });
    delete user.password;

    return res.status(200).send({ id: user._id, email: user.email });
  }
}

export default UsersController;
