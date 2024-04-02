const redis = require("redis");
const { promisify } = require("util");

class RedisClient {
  constructor() {
    // cree un client redis
    this.client = redis.createClient();

    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);

    // gestion des erreurs
    this.client.on("error", (ERROR) => {
      console.error(`error redis client: ${ERROR}`);
    });
  }

  isAlive() {
    return this.client.connected;
  }

  // recupere valeur clé
  async get(key) {
    return this.getAsync(key);
  }

  // stoke valeur et expiration
  async set(key, value, duration) {
    return this.setAsync(key, value, "EX", duration);
  }

  // supprime la cle
  async del(key) {
    return this.delAsync(key);
  }
}

// Exportation
const redisClient = new RedisClient();
module.exports = redisClient;
