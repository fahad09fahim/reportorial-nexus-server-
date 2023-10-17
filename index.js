const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.x4eccmn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const courseCollection = client.db("reportorial").collection("course");
    const selectedCourseCollection = client
      .db("reportorial")
      .collection("selectedCourse");
    const paymentCollection = client.db("reportorial").collection("payment");

    app.get("/course", async (req, res) => {
      const result = await courseCollection.find().toArray();
      res.send(result);
    });
    // selected course api
    app.get("/selected", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const selectedCourse = await selectedCourseCollection
        .find(query)
        .toArray();
      res.send(selectedCourse);
    });
    app.post("/selected", async (req, res) => {
      const selectedCourse = req.body;
      const result = await selectedCourseCollection.insertOne(selectedCourse);
      res.send(result);
    });
    app.delete("/selected/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCourseCollection.deleteOne(query);
      res.send(result);
    });
    // create payment  intent
    app.post("/payment", async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.selectedCoursesId.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await selectedCourseCollection.deleteMany(query);
      res.send({ result, deleteResult });
    });
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //  enrolled course api
    app.get("/enroll", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { email: email };
      const enrolled = await paymentCollection.find(query).toArray();
      const coursesIds = enrolled.map((enrollment) => enrollment.coursesId);
      const flattenedCourseIds = [].concat(...coursesIds);
      const courseQuery = {
        _id: { $in: flattenedCourseIds.map((id) => new ObjectId(id)) },
  };
      const courses = await courseCollection.find(courseQuery).toArray();
      res.send(courses);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`app listening on port${port}`);
});
