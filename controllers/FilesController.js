import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';

const { ObjectId } = require('mongodb');

class FilesController {
  static async postFiles(request, response) {
    const { name, type, parentId, isPublic, data } = request.body;

    // Vérification de la présence du token dans l'en-tête de la requête
    const token = request.header('X-Token');
    if (!token) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Récupération de l'utilisateur basé sur le token
    const user = await dbClient.db.collection('users').findOne({ token });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    // Vérification de la présence du nom du fichier
    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }

    // Vérification de la présence et de la validité du type de fichier
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return response.status(400).json({ error: 'Missing or invalid type' });
    }

    // Vérification de la présence des données si le type n'est pas un dossier
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    // Vérification du parent s'il est défini
    if (parentId) {
      const parentFile = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Crée le chemin de stockage des fichiers
    const storingFolder = process.env.FOLDER_PATH || '/tmp/files_manager';

    // Génére d'un identifiant unique pour le fichier
    const fileUuid = uuidv4();

    // Chemin  du fichier sur le disque
    const filePath = path.join(storingFolder, fileUuid);

    // Si le type est un dossier, enregistrement uniquement dans database
    if (type === 'folder') {
      const newFile = await dbClient.db.collection('files').insertOne({
        userId: user._id,
        name,
        type,
        isPublic: isPublic || false,
        parentId: parentId || 0,
      });

      return response.status(201).json(newFile.ops[0]);
    }

    // Si le type est un fichier, enregistre le fichier sur disque et db
    const fileBuffer = Buffer.from(data, 'base64');

    // Création du dossier de stockage s'il n'existe pas
    fs.mkdirSync(storingFolder, { recursive: true });

    // Écriture du contenu du fichier sur le disque
    fs.writeFileSync(filePath, fileBuffer);

    // Enregistrement du fichier dans la base de données
    const newFile = await dbClient.db.collection('files').insertOne({
      userId: user._id,
      name,
      type,
      isPublic: isPublic || false,
      parentId: parentId || 0,
      localPath: filePath,
    });

    return response.status(201).json(newFile.ops[0]);
  }
}

export default FilesController;
