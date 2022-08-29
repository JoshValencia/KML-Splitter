const {
  readFileSync,
  unlinkSync,
  writeFile,
  createWriteStream,
  existsSync,
} = require("fs");
const path = require("path");
const express = require("express");
const upload = require("express-fileupload");
const app = express();
const JSZip = require("jszip");
const xml2js = require("xml2js");
const builder = new xml2js.Builder();
const parser = new xml2js.Parser();

const PORT = process.env.PORT || 8080;

app.use(upload());
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  if (existsSync("./output/output.zip")) {
    unlinkSync("./output/output.zip");
  }
  res.render("index");
});

app.post("/upload_kml", (req, res) => {
  if (req.files) {
    const file = req.files.kml;
    const filename = file.name;

    file.mv(`./uploads/${filename}`, function (err) {
      if (err) {
        res.send(err);
      } else {
        console.log("File is being processed");
        const path = `./uploads/${filename}`;
        const xml = readFileSync(path).toString();
        parser.parseString(xml, function (err, result) {
          const document = result.kml.Document[0];
          const placeMarks = document.Placemark;
          const styles = document.Style;
          const formatJSONArray = placeMarks.map((placemark) => {
            const style = styles.find((style) => {
              if ("#" + style["$"].id == placemark.styleUrl[0]) {
                return style;
              }
            });
            return {
              kml: {
                $: {
                  xmlns: "http://www.opengis.net/kml/2.2",
                },
                name: placemark.name[0] + ".kml",
                Style: style,
                Placemark: placemark,
              },
            };
          });

          const zip = new JSZip();
          formatJSONArray.forEach((kmlGroups, i) => {
            if (i == 3) return;
            const generatedXML = builder.buildObject(kmlGroups);
            zip.file(`${kmlGroups.kml.name}`, generatedXML);
          });
          zip
            .generateNodeStream({ type: "nodebuffer", streamFiles: true })
            .pipe(createWriteStream(`./output/output.zip`))
            .on("finish", function () {
              console.log(`${filename}.zip written.`);

              res.download(__dirname + "/output/output.zip", `${filename}.zip`);
            });
        });
        unlinkSync(path);
      }
    });
  }
});

app.get("/*", (req, res) => {
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`Listening on PORT ${PORT}`);
});
