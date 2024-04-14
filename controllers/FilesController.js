import fs from 'fs';
import mime from 'mime-types';
import Bull from 'bull';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Bull('fileQueue');

class FilesController {
  static async postUpload(request, response) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = request.body;

    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }

    const allowedTypes = ['folder', 'file', 'image'];
    if (!type || !allowedTypes.includes(type)) {
      return response.status(400).json({ error: 'Missing type' });
    }

    if (!data && type !== 'folder') {
      return response.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const project = new ObjectId(parentId);
      const file = await dbClient.db.collection('files').findOne({ _id: project });
      if (!file) {
        return response.status(400).json({ error: 'Parent not found' });
      }

      if (file.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    let newFile;
    if (type === 'folder') {
      newFile = await dbClient.db.collection('files').insertOne({
        userId: new ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
      });
    } else {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }

      const localPath = `${folderPath}/${uuidv4()}`;
      const buff = Buffer.from(request.body.data, 'base64');
      await fs.promises.writeFile(localPath, buff);
      newFile = await dbClient.db.collection('files').insertOne({
        userId: new ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
        localPath,
      });

      if (type === 'image') {
        fileQueue.add({ userId, fileId: newFile.insertedId });
      }
    }

    return response.status(201).send({
      id: newFile.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(request, response) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }

    return response.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getIndex(request, response) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId, page = 0 } = request.query;
    const query = { userId: ObjectId(userId) };
    if (parentId) {
      query.parentId = ObjectId(parentId);
    }

    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(page * 20)
      .limit(20)
      .toArray();

    const filesFormatted = files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));

    return response.status(200).json(filesFormatted);
  }

  static async putPublish(request, response) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const result = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: ObjectId(id), userId: ObjectId(userId) },
      { $set: { isPublic: true } },
      { returnOriginal: false },
    );

    if (!result.value) {
      return response.status(404).json({ error: 'Not found' });
    }

    return response.status(200).json({
      id: result.value._id,
      userId: result.value.userId,
      name: result.value.name,
      type: result.value.type,
      isPublic: result.value.isPublic,
      parentId: result.value.parentId,
    });
  }

  static async putUnpublish(request, response) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const result = await dbClient.db.collection('files').findOneAndUpdate(
      { _id: ObjectId(id), userId: ObjectId(userId) },
      { $set: { isPublic: false } },
      { returnOriginal: false },
    );

    if (!result.value) {
      return response.status(404).json({ error: 'Not found' });
    }

    return response.status(200).json({
      id: result.value._id,
      userId: result.value.userId,
      name: result.value.name,
      type: result.value.type,
      isPublic: result.value.isPublic,
      parentId: result.value.parentId,
    });
  }

  static async getFile(request, response) {
    const { id } = request.params;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });

    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }

    const token = request.headers['x-token'];
    const userId = token ? await redisClient.get(`auth_${token}`) : null;

    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return response.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return response.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    if (!fs.existsSync(file.localPath)) {
      return response.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);
    response.setHeader('Content-Type', mimeType || 'text/plain');

    const fileContent = fs.readFileSync(file.localPath, 'utf8');
    return response.status(200).send(fileContent);
  }

  static async getFileData(request, response) {
    const { id } = request.params;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });

    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }

    const token = request.headers['x-token'];
    const userId = token ? await redisClient.get(`auth_${token}`) : null;

    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return response.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return response.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    if (!fs.existsSync(file.localPath)) {
      return response.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);
    response.setHeader('Content-Type', mimeType || 'text/plain');

    const fileContent = fs.readFileSync(file.localPath, 'utf8');
    return response.status(200).send(fileContent);
  }
}

export default FilesController;
