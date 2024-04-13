import fs from 'fs';
import Bull from 'bull';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Bull('fileQueue');

class FilesController {
  static async postUpload(request, response) {
    // Existing implementation
  }

  static async getShow(request, response) {
    const token = request.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = request.params;

    try {
      const file = await dbClient.db.collection('files').findOne({
        _id: ObjectId(id),
        userId: ObjectId(userId),
      });

      if (!file) {
        return response.status(404).json({ error: 'Not found' });
      }

      return response.json(file);
    } catch (error) {
      return response.status(404).json({ error: 'Not found' });
    }
  }

  static async getIndex(request, response) {
    const token = request.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = 0, page = 0 } = request.query;
    const perPage = 20;
    const skip = parseInt(page) * perPage;

    try {
      const files = await dbClient.db.collection('files').aggregate([
        { $match: { userId: ObjectId(userId), parentId: parentId } },
        { $skip: skip },
        { $limit: perPage },
      ]).toArray();

      return response.json(files);
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default FilesController;
