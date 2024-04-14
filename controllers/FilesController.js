import { ObjectId } from 'mongodb';
import fs from 'fs';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Bull('fileQueue');

class FilesController {
  // Method to create a new file.
  static async postUpload(request, response) {
    // Existing code for postUpload method...
  }

  // Method to retrieve the information of a file.
  static async getShow(request, response) {
    // Existing code for getShow method...
  }

  // Method to retrieve the list of files.
  static async getIndex(request, response) {
    // Existing code for getIndex method...
  }

  // Authenticates the user before modifying the file.
  static async putPublish(request, response) {
    // Existing code for putPublish method...
  }

  // Method to make a file non-public (remove the publication).
  static async putUnpublish(request, response) {
    // Existing code for putUnpublish method...
  }

  // Method to retrieve the content of a file specified by its ID.
  static async getFile(request, response) {
    // Retrieve the file ID from the request params.
    const { id } = request.params;

    // Find the file in the database.
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });

    // Check if the file exists.
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }

    // Retrieve the user's authentication token if present.
    const token = request.headers['x-token'];
    const userId = token ? await redisClient.get(`auth_${token}`) : null;

    // Check if the file is public or if the user is authorized to access it.
    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return response.status(404).json({ error: 'Not found' });
    }

    // Check if the file is a folder, in which case its contents cannot be retrieved.
    if (file.type === 'folder') {
      return response.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    // Check if the file exists locally on the server.
    if (!fs.existsSync(file.localPath)) {
      return response.status(404).json({ error: 'Not found' });
    }

    // Determine the MIME type of the file.
    const mimeType = mime.lookup(file.name);
    response.setHeader('Content-Type', mimeType || 'text/plain');

    // Send the file content as response.
    return response.status(200).sendFile(file.localPath);
  }

  // Method to retrieve the content of a file specified by its ID (Task 8).
  static async getFileData(request, response) {
    // Retrieve the file ID from the request params.
    const { id } = request.params;

    // Find the file in the database.
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(id) });

    // Check if the file exists.
    if (!file) {
      return response.status(404).json({ error: 'Not found' });
    }

    // Retrieve the user's authentication token if present.
    const token = request.headers['x-token'];
    const userId = token ? await redisClient.get(`auth_${token}`) : null;

    // Check if the file is public or if the user is authorized to access it.
    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return response.status(404).json({ error: 'Not found' });
    }

    // Check if the file is a folder, in which case its contents cannot be retrieved.
    if (file.type === 'folder') {
      return response.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    // Check if the file exists locally on the server.
    if (!fs.existsSync(file.localPath)) {
      return response.status(404).json({ error: 'Not found' });
    }

    // Determine the MIME type of the file.
    const mimeType = mime.lookup(file.name);
    response.setHeader('Content-Type', mimeType || 'text/plain');

    // Send the file content as response.
    return response.status(200).sendFile(file.localPath);
  }
}

export default FilesController;
