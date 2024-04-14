import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  // Existing methods
  
  static async putPublish(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    try {
      const file = await dbClient.db.collection('files').findOneAndUpdate(
        { _id: ObjectId(id), userId: ObjectId(userId) },
        { $set: { isPublic: true } },
        { returnDocument: 'after' }
      );

      if (!file.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.json(file.value);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    try {
      const file = await dbClient.db.collection('files').findOneAndUpdate(
        { _id: ObjectId(id), userId: ObjectId(userId) },
        { $set: { isPublic: false } },
        { returnDocument: 'after' }
      );

      if (!file.value) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.json(file.value);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
