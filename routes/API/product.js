var express = require('express');
var router = express.Router();
const Multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
const mysql = require('mysql');
const multer = Multer({
    storage: Multer.MemoryStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // no larger than 5mb
    }
});

// gets the config settings for the db
const sqlConfig = {
    user: process.env.SQL_USERNAME,
    password: process.env.SQL_PASSWORD,
    host: process.env.SQL_HOST,
    port: process.env.SQL_PORT,
    database: process.env.SQL_DATABASE
};

// creates a pool to handle query requests.
const pool = mysql.createPool(sqlConfig);

/**
 * Gets all the products if there is no id in query
 * @Returns json object containing all products
*/
router.get('/', async function (req, res, next) {
    if (req.query && req.query.id) {
        next();
        return;
    }

    var products = await new Promise(function (resolve, reject) {
        const query = `SELECT * FROM Product;`
        pool.query(query, function (error, results) {
            if (error) {
                req.err = error;
                reject(error);
            } else {
                resolve(results);
            }
        });
    });

    res.json(products);
});

/**
 * Gets a product given a productId.
 * @Parameter req.query.id productId
 * @Return returns a product and switches to a page with product info.
 */
router.get('/', async function (req, res, next) {
    var product = await new Promise(function (resolve, reject) {
        const query = 'SELECT * FROM Product WHERE productId = ?';
        const values = [req.query.id];

        pool.query(query, values, function (error, results) {
            if (error) {
                req.err = error;
                reject(error);
            } else {
                resolve(results);
            }
        });
    });

    res.render('productPage', { product: product && product.length ? JSON.stringify(product["0"]) : JSON.stringify({})});
});

/**
 * Adds a product to the database.
 */
router.post('/add', multer.single('photo'), async function (req, res) {
    if (req.file) {
        console.log(req.file);
        
        const insertId = await googleAuth()
            .then((jWTClient) => uploadToDrive(req.file, req.file.originalname, req.file.mimetype, jWTClient))
            .then((imgId) => new Promise(function (resolve, reject) {
                console.log(imgId);

            const query = 'INSERT INTO Product VALUES (NULL, ?, ?, ?, ?, ?, ?)';
            const values = [
                req.body.productName,
                req.body.productBrand,
                req.body.productInfo,
                imgId,
                req.body.productStock,
                req.body.productCost
            ];
            pool.query(query, values, function (error, results) {
                if (error) {
                    req.err = error;
                    reject(error);
                } else {
                    resolve(results.insertId);
                }
            });
        }));

        return res.json(insertId);

    } else {
        res.redirect("/users");
    }

    res.send('File uploaded');
});

/**
 * Gets a google auth token
 * @return googleAuth token
 */
async function googleAuth() {
    let cred = {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n')
    }

    // make a new auth token
    const jWTClient = new google.auth.JWT(
        cred.client_email,
        null,
        cred.private_key,
        ['https://www.googleapis.com/auth/drive']
    );

    // authorize the token
    jWTClient.authorize(function (err, tokens) {
        if (err) {
            console.log("failed");
            console.log(err);
            return;
        } else {
            console.log("Google autorization complete");
        }
    });

    return jWTClient;
}

/**
 * This method takes in a file, its name, and its file type and returns a google image id.
 * @param {any} file
 * @param {any} name
 * @param {any} mimetype
 * @returns string google img id.
 */
async function uploadToDrive(file, name, mimetype, jWTClient) {
    let fileObject = file;
    let bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);

    // push the file into the google drive folder
    return google.drive({ version: 'v3' })
        .files.create({
            auth: jWTClient,
            media: {
                mimeType: mimetype,
                body: bufferStream
            },
            resource: {
                name: name,
                parents: ['1hLeqyoaHQZfwOxsD9Kpm5xKLhU87S_L9']
            },
            fields: 'id',
        }).then(function (resp) {
            console.log(resp.data, 'resp.data');
            return resp.data.id;
        }).catch(function (error) {
            console.log(error);
        });
}

module.exports = router;
