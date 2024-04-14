import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
class FilesController {
  // Method to create a new file.
  static async postUpload(request, response) {
    const token = request.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    // Checks the existence and validity of the token.
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    // Extraction of the file information from the request body.
    const {
      name,
      type,
      parentId = 0,
      isPublic = false,
      data,
    } = request.body;
    // Check if the name is provided.
    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    // Check if the type is valid.
    const allowedTypes = ['folder', 'file', 'image'];
    if (!type || !allowedTypes.includes(type)) {
      return response.status(400).json({ error: 'Missing type' });
    }
    // Check if the data is provided for a file.
    if (!data && type !== 'folder') {
      return response.status(400).json({ error: 'Missing data' });
    }
    // Check if the parent folder exists.
    let parentFile = null;
    if (parentId !== 0) {
      parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile || parentFile.type !== 'folder') {
        return response.status(400).json({ error: 'Parent not found or is not a folder' });
      }
    }
    // Creation of the new file in the database.
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
      // Creation of the file on the server.
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
      // Write the file to the server.
      const filePath = `${folderPath}/${uuidv4()}`;
      const buff = Buffer.from(request.body.data, 'base64').toString('utf-8');
      await fs.promises.writeFile(filePath, buff);
      newFile = await dbClient.db.collection('files').insertOne({
        userId: new ObjectId(userId),
        name,
        type,
        isPublic,
        parentId,
        localPath: filePath,
      });
    }
    // Return the new file.
    return response.status(201).send({
      id: newFile.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }
}
export default FilesController;