import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

class FilesController {
  static async postUpload(req, res) {
    const { name, type, data, parentId, isPublic } = req.body;
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await FilesController.getUserIdByToken(token);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing or invalid type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || '0',
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileDocument);
      const insertedFile = { ...fileDocument, id: result.insertedId };

      return res.status(201).json(insertedFile);
    }

    const fileData = Buffer.from(data, 'base64');
    const filePath = path.join(FOLDER_PATH, uuidv4());

    fs.writeFileSync(filePath, fileData);

    const result = await dbClient.db.collection('files').insertOne({
      ...fileDocument,
      localPath: filePath,
    });
    const insertedFile = { ...fileDocument, id: result.insertedId };

    return res.status(201).json(insertedFile);
  }

  static async getUserIdByToken(token) {

    return null;
  }
}

export default FilesController;
