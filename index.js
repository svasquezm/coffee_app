/* ---------------- index.js ---------------- */
/* Main application file. Save as index.js */

require('dotenv').config();

const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');

const ssmClient = new SSMClient({ region: "us-east-1" });
const app = express();
app.use(express.json());

async function getParameter(name, withDecryption = false) {
  const command = new GetParameterCommand({
    Name: name,
    WithDecryption: withDecryption
  });
  const response = await ssmClient.send(command);
  return response.Parameter.Value;
}

// Load environment variables
(async () => {
    try {
      const DB_HOST = await getParameter("/prod/rds/coffee/host", true) || 'localhost';
      const DB_PORT = process.env.DB_PORT || 3306;
      const DB_NAME = process.env.DB_NAME || 'coffee_db';
      const DB_USER = await getParameter("/prod/rds/coffee/user", true) || 'root';
      const DB_PASSWORD = await getParameter("/prod/rds/coffee/password", true) || '';
      const PORT = process.env.PORT || 3000;
      
      // Initialize Sequelize
      const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
        host: DB_HOST,
        port: DB_PORT,
        dialect: 'mysql',
        logging: false,
      });
      
      // Models
      const Coffee = sequelize.define('Coffee', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        country: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
      }, {
        tableName: 'coffee',
        timestamps: false,
      });
      
      const CoffeeDrink = sequelize.define('CoffeeDrink', {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(150),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        }
      }, {
        tableName: 'coffee_drink',
        timestamps: false,
      });
      
      // Association: coffee_drink.coffee_id -> coffee.id
      Coffee.hasMany(CoffeeDrink, { foreignKey: 'coffee_id' });
      CoffeeDrink.belongsTo(Coffee, { foreignKey: 'coffee_id' });
      
      // Routes
      
      // GET /coffee/list -> return all coffees
      app.get('/coffee/list', async (req, res) => {
        try {
          const coffees = await Coffee.findAll();
          return res.json({ data: coffees });
        } catch (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });
      
      // GET /coffee/drinks/list -> return all coffee_drink with their coffee (optional)
      app.get('/coffee/drinks/list', async (req, res) => {
        try {
          const drinks = await CoffeeDrink.findAll({ include: [{ model: Coffee, attributes: ['id', 'name', 'country'] }] });
          return res.json({ data: drinks });
        } catch (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });
      
      // POST /coffee -> create a new coffee
      // Expected body: { name: string, country: string }
      app.post('/coffee', async (req, res) => {
          try {
            const { name, country } = req.body;
            if (!name || !country) {
              return res.status(400).json({ error: 'name is required' });
            }
        
            const newCoffee = await Coffee.create({ name, country });
            return res.status(201).json({ data: newCoffee });
          } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal server error' });
          }
        });
      
      // POST /coffee/drinks -> create a new coffee_drink
      // Expected body: { name: string, coffee_id: number, description?: string }
      app.post('/coffee/drinks', async (req, res) => {
        try {
          const { name, coffee_id, description } = req.body;
          if (!name || !coffee_id) {
            return res.status(400).json({ error: 'name and coffee_id are required' });
          }
      
          // Verify the coffee exists
          const coffee = await Coffee.findByPk(coffee_id);
          if (!coffee) {
            return res.status(400).json({ error: `No coffee found with id ${coffee_id}` });
          }
      
          const newDrink = await CoffeeDrink.create({ name, coffee_id, description });
          return res.status(201).json({ data: newDrink });
        } catch (err) {
          console.error(err);
          return res.status(500).json({ error: 'Internal server error' });
        }
      });
      
      // Health check
      app.get('/health', (req, res) => res.json({ status: 'ok' }));
      
      // Sync DB and start server
      (async () => {
        try {
          await sequelize.authenticate();
          console.log('Connection has been established successfully.');
      
          // Sync models (creates tables if not exist) - be careful: in production, use migrations!
          await sequelize.sync();
          console.log('Models synchronized.');
      
          app.listen(PORT, () => {
            console.log(`Server listening on port ${PORT}`);
          });
        } catch (error) {
          console.error('Unable to connect to the database:', error);
          process.exit(1);
        }
      })();
      
    } catch (err) {
      console.error("Error obteniendo parámetros:", err);
    }
  })();


