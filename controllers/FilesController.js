import fs from 'fs';
import path from 'path';
import dbClient from '../utils/db';

class FilesController {
  static async postUpload(req, res) {
    const { name, type, parentId = 0, isPublic = false, data } = req.body;
    const { 'x-token': token } = req.headers;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await AuthController.getUserIdByToken(token);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (['file', 'image'].includes(type) && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parentFile = await dbClient.getFile(parentId);
      if (!parentFile || parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent not found or is not a folder' });
      }
    }

    let localPath;
    if (['file', 'image'].includes(type)) {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      localPath = path.join(folderPath, `${uuidv4()}`);
      const fileData = Buffer.from(data, 'base64');
      fs.writeFileSync(localPath, fileData);
    }

    const newFile = {
      userId,
      name,
      type,
      parentId,
      isPublic,
      localPath: type === 'file' || type === 'image' ? localPath : undefined,
    };

    const fileId = await dbClient.createFile(newFile);

    return res.status(201).json({
      id: fileId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }
}

export default FilesController;
