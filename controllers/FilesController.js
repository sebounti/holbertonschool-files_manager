import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import dbClient from '../utils/db';

class FilesController {
  static async postUpload(request, response) {
    const fileQueue = new Bull('fileQueue');

    const token = request.header('X-Token') || null;
    if (!token) return response.status(401).send({ error: 'Unauthorized' });

    const userId = request.user._id; // Je suppose que vous avez une propriété user dans votre objet request
    const fileName = request.body.name;
    if (!fileName) return response.status(401).send({ error: 'Missing name' });

    const fileType = request.body.type;
    if (!fileType || !['folder', 'file', 'image'].includes(fileType))
      return response.status(400).send({ error: 'Missing or invalid type' });

    const fileData = request.body.data;
    if (!fileData && ['file', 'image'].includes(fileType))
      return response.status(400).send({ error: 'Missing Data' });

    let fileParentId = request.body.parentId || 0;
    fileParentId = fileParentId === '0' ? 0 : fileParentId;

    if (fileParentId !== 0) {
      const parentFile = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(fileParentId) });
      if (!parentFile)
        return response.status(400).send({ error: 'Parent not found' });
      if (!['folder'].includes(parentFile.type))
        return response.status(400).send({ error: 'Parent is not a folder' });
    }

    const fileDataDb = {
      userId,
      name: fileName,
      type: fileType,
      isPublic: fileIsPublic,
      parentId: fileParentId,
    };

    if (['folder'].includes(fileType)) {
      await dbClient.db.collection('files').insertOne(fileDataDb);
      return response.status(201).send({
        id: fileDataDb._id,
        userId: fileDataDb.userId,
        name: fileDataDb.name,
        type: fileDataDb.type,
        isPublic: fileDataDb.isPublic,
        parentId: fileDataDb.parentId,
      });
    }

    const storingFolder = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileUuid = uuidv4();
    const pathFile = `${storingFolder}/${fileUuid}`;

    fs.mkdir(pathDir, { recursive: true }, (error) => {
      if (error) return response.status(400).send({ error: error.message });
    });

    const buff = Buffer.from(fileData, 'base64');
    fs.writeFile(pathFile, buff, (error) => {
      if (error) return response.status(400).send({ error: error.message });

      fileDataDb.localPath = pathFile;
      dbClient.db.collection('files').insertOne(fileDataDb);

      fileQueue.add({
        userId: fileDataDb.userId,
        fileId: fileDataDb._id,
      });

      return response.status(201).send({
        id: fileDataDb._id,
        userId: fileDataDb.userId,
        name: fileDataDb.name,
        type: fileDataDb.type,
        isPublic: fileDataDb.isPublic,
        parentId: fileDataDb.parentId,
      });
    });
  }
}

export default FilesController;
