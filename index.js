
'use strict';
const {
  getSessionFromStorage,
  getSessionIdFromStorageAll,
  Session,
  login,
  fetch
} = require("@inrupt/solid-client-authn-node");

//var cors = require('cors');
const { getFile, isRawData, isContainer,getResourceInfo, getContentType, getSourceUrl,getPodUrlAll, getSolidDataset, getContainedResourceUrlAll, getThing, getUrlAll, getAgentAccessAll, getPublicAccess,getGroupAccessAll,hasResourceAcl} = require("@inrupt/solid-client");
const { RDF, ODRL }= require("@inrupt/vocab-common-rdf");

var sessionid;
const myJsonCat = require('./personaldata.json');
const myJsonPur = require('./purposes.json');
 var session;
var fs = require('fs'),
    path = require('path'),
    http = require('http');
const express = require("express");
const cookieSession = require("cookie-session");
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
var cors = require('cors')
//var app = require('connect')();
const app = express();
const port = 8000;
var processing = false;



function insertSpaces(string) {
     string = string.replace(/([a-z])([A-Z])/g, '$1 $2');
     string = string.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
     return string;
 }
// Log to console
const getParent = (root, id) =>  {
       var node;

       root.some(function (n) {
           if (n.label == id) {
                 return node = n;
           }
           if (n.children) {
               return node = getParent(n.children, id);
           }
       });
       return node|| null;
   }
const dpvpd = "https://www.w3id.org/dpv/dpv-pd/#" ;
const oac = "https://w3id.org/oac/" ;
const dpv = "http://www.w3.org/ns/dpv#";



app.use(cors());
// The following snippet ensures that the server identifies each user's session
// with a cookie using an express-specific mechanism
app.use(
  cookieSession({
    name: "session",
    // These keys are required by cookie-session to sign the cookies.
    keys: [
      "Required, but value not relevant for this demo - key1",
      "Required, but value not relevant for this demo - key2",
    ],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/login", async (req, res, next) => {
  // 1. Create a new Session
   session = new Session();
  req.session.sessionId = session.info.sessionId;
  const redirectToSolidIdentityProvider = (url) => {
    // Since we use Express in this example, we can call `res.redirect` to send the user to the
    // given URL, but the specific method of redirection depend on your app's particular setup.
    // For example, if you are writing a command line app, this might simply display a prompt for
    // the user to visit the given URL in their browser.
    res.redirect(url);
  };
  // 2. Start the login process; redirect handler will handle sending the user to their
  //    Solid Identity Provider.
  await session.login({
    // After login, the Solid Identity Provider will send the user back to the following
    // URL, with the data necessary to complete the authentication process
    // appended as query parameters:
    redirectUrl: `http://localhost:${port}/redirect-from-solid-idp`,
    // Set to the user's Solid Identity Provider; e.g., "https://broker.pod.inrupt.com"
    oidcIssuer: "https://broker.pod.inrupt.com",
    // Pick an application name that will be shown when asked
    // to approve the application's access to the requested data.
    clientName: "TFM api",
    handleRedirect: redirectToSolidIdentityProvider,
  });
});

app.get("/redirect-from-solid-idp", async (req, res) => {
  // 3. If the user is sent back to the `redirectUrl` provided in step 2,
  //    it means that the login has been initiated and can be completed. In
  //    particular, initiating the login stores the session in storage,
  //    which means it can be retrieved as follows.
   sessionid = await getSessionFromStorage(req.session.sessionId);

  // 4. With your session back from storage, you are now able to
  //    complete the login process using the data appended to it as query
  //    parameters in req.url by the Solid Identity Provider:
  await sessionid.handleIncomingRedirect(`http://localhost:${port}${req.url}`);

  // 5. `session` now contains an authenticated Session instance.
  if (sessionid.info.isLoggedIn) {
    return res.send(`<p>Logged in with the WebID ${sessionid.info.webId}.</p>`)
  }
    //});
});

/**
 * Returns data from pod
 * Makes a query to the SOLID pod of the user in order to comply with a Right of access request.
 *
 * webID String The WebId of the user making the Right of access petition.
 * catPData List The categories of data that the user making the Right of access petition wants to know.
 * purPData List The purposes of data that the user making the Right of access petition wants to know.
 * returns RightOfAccess -
                      name: Obtain from uri - uri.substring(url.lastIndexOf("/") + 1);
                      uri: 2 steps 1- getSourceUrl 2- encodeURIComponent()
                      category: from the category that matches
                      purpose: run the
                      recipients: check
                      duration: Make string
 **/

app.get("/getFiles", async (req, res, next) => {

    var catPData = req.query["catPData"];
    if(typeof(catPData) != "object"){
      catPData = catPData.split(",");
    }

    console.log(catPData);
    console.log(typeof(catPData));
    var purPData = req.query["purPData"];
    if(typeof(purPData) != "object"){
      purPData = purPData.split(",");
    }
    console.log(purPData);
    console.log(typeof(purPData));

    var webID = req.headers['webid'];
    console.log(webID);
    console.log(typeof(webID));


    var result = {processed:processing,
                  format:{dataSubjectRights:"Out of the scope of this TFM.",
                             safeguards:"Out of the scope of this TFM.",
                             resource:[]
                           }
  };
    try{
    //Obtain root of the pod
    let podRoot = "";
    await getPodUrlAll(webID).then(response => {
         podRoot = response[0];
      });


    const policiesContainer = podRoot+'private/odrl_policies/';

    // get list of policies

    console.log("get list of policies ");
    console.log(policiesContainer);

    const policyDataset = await getSolidDataset(policiesContainer, { fetch: sessionid.fetch });
    const policyList = getContainedResourceUrlAll(policyDataset, { fetch: sessionid.fetch });
    console.log(policyList);

    var policyListPermission=[];
    var policyListProhibition=[];
    for (var i = 0; i < policyList.length; i++){
      const policy = await getSolidDataset( policyList[i], { fetch: sessionid.fetch });
      if(JSON.stringify(policy.graphs.default).indexOf("prohibition1") < 0){
        policyListPermission.push(policyList[i]);
      }else{
        policyListProhibition.push(policyList[i]);
      }
    }
  console.log("Permissions: \n"+policyListPermission);
  console.log("Prohibitions: \n"+policyListProhibition);

    // get list of files in personal_data/ container

    console.log("get list of files in all containers");
    const personalDataset = await getSolidDataset(podRoot, { fetch: sessionid.fetch });
    let personalDataFilesList = getContainedResourceUrlAll(personalDataset);
    for (var i = 0; i < personalDataFilesList.length; i++){
      if(isContainer(personalDataFilesList[i])){
        const dataset = await getSolidDataset(personalDataFilesList[i], { fetch: sessionid.fetch });
        personalDataFilesList = personalDataFilesList.concat(getContainedResourceUrlAll(dataset, { fetch: sessionid.fetch }));
      }
    }
    personalDataFilesList = personalDataFilesList.filter( function( el ) {
      return !policyList.includes( el );
      }
    );
    console.log(personalDataFilesList);

    //Cleaning policyList depending on the parameters passed.
  console.log("Cleaning policyList depending on the categories passed.");
    if(catPData[0] != "0"){
      console.log(catPData);
      console.log(policyListPermission);
      for (var k = 0; k < policyListPermission.length; k++){
        const policyPermission = await getSolidDataset( policyListPermission[k], { fetch: sessionid.fetch });
        const policyPermissionThing = `${policyListPermission[k]}#permission1`
        const thing = getThing( policyPermission, policyPermissionThing);
        // get category of data targeted by the policy
        console.log("Get category of data targeted by the permission policy.");

        const targetDataPolicy = getUrlAll(thing, ODRL.target);
        console.log(policyListPermission[k].substring(policyListPermission[k].lastIndexOf("/") + 1) +" "+targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1));
        console.log(catPData.includes(targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)));
        //console.log(catPData.some((e) => getParent(myJsonCat,targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)).parents.includes(e)));
        if(!catPData.includes(targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)) && !catPData.some((e) => getParent(myJsonCat,targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)).parents.includes(e)) ){
          console.log("Eliminating permission policy");
          policyListPermission.splice(k, 1);
          k--;
        }
      }
      console.log(policyListProhibition);
      for (var k = 0; k < policyListProhibition.length; k++){
        const policyProhibition = await getSolidDataset( policyListProhibition[k], { fetch: sessionid.fetch });
        const policyProhibitionThing = `${policyListProhibition[k]}#prohibition1`
        const thing = getThing( policyProhibition, policyProhibitionThing);
        // get category of data targeted by the policy
        console.log("Get category of data targeted by the prohibition policy.");

        const targetDataPolicy = getUrlAll(thing, ODRL.target);
        console.log(catPData.includes(targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)));
        console.log(catPData.some((e) => getParent(myJsonCat,targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)).parents.includes(e)));
        if(!catPData.includes(targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)) && !catPData.some((e) => getParent(myJsonCat,targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)).parents.includes(e)) ){
          console.log("Eliminating prohibition policy");
          policyListProhibition.splice(k, 1);
          k--;
        }

      }
    }
    console.log("Cleaning policyList depending on the purposes passed.");
    if(purPData[0] != "0"){
      console.log(purPData);
      console.log(policyListPermission);
      console.log(policyListPermission.length);
      for (var k = 0; k < policyListPermission.length; k++){
        const policyPermission = await getSolidDataset( policyListPermission[k], { fetch: sessionid.fetch });
        const purposeConstraintThing = `${policyListPermission[k]}#purposeConstraint`;
        const purposeThing = getThing( policyPermission, purposeConstraintThing);
        const purposeData = getUrlAll(purposeThing, ODRL.rightOperand);
        console.log(purposeData);
        console.log(purPData.some((e) => purposeData.includes("http://www.w3.org/ns/dpv#"+e)));
        console.log(purPData.some((e) => purposeData.some((e2) => getParent(myJsonPur,insertSpaces(e2.split("#").pop())).parents.includes(e))));

        if(!purPData.some((e) => purposeData.includes("http://www.w3.org/ns/dpv#"+e))  &&  !purPData.some((e) => purposeData.some((e2) => getParent(myJsonPur,insertSpaces(e2.split("#").pop())).parents.includes(e))) ) {
          console.log("Eliminating permission policy");
          policyListPermission.splice(k, 1);
          k--;
        }

      }
      console.log(policyListProhibition + policyListProhibition.length);
      for (var k = 0; k < policyListProhibition.length; k++){
        const policyProhibition = await getSolidDataset( policyListProhibition[k], { fetch: sessionid.fetch });
        const purposeConstraintThing = `${policyListProhibition[k]}#purposeConstraint`;
        const purposeThing = getThing( policyProhibition, purposeConstraintThing);
        const purposeData = getUrlAll(purposeThing, ODRL.rightOperand);
        console.log(purposeData);
        console.log(purPData.some((e) => purposeData.includes("http://www.w3.org/ns/dpv#"+e)));
        console.log(purPData.some((e) => purposeData.some((e2) => getParent(myJsonPur,insertSpaces(e2.split("#").pop())).parents.includes(e))));
        if(!purPData.some((e) => purposeData.includes("http://www.w3.org/ns/dpv#"+e))&&  !purPData.some((e) => purposeData.some((e2) => getParent(myJsonPur,insertSpaces(e2.split("#").pop())).parents.includes(e))) ) {
          console.log("Eliminating prohibition policy");
          policyListProhibition.splice(k, 1);
          k--;
        }

      }
    }
    console.log("POLICY PERMISSION LIST: ")
    console.log(policyListPermission);
    console.log("POLICY PROHIBITION LIST: ")
    console.log(policyListProhibition);


    //Start getting list of files to give back.

    console.log("Start getting list of files to give back.");

    //Going through each file to see with which policies it identifies.
    for (var pdfl = 0; pdfl< personalDataFilesList.length;pdfl++){
      var personalDataFile = await getFile( personalDataFilesList[pdfl], { fetch: sessionid.fetch });
      if(!isRawData(personalDataFile)){

        personalDataFile = await getSolidDataset( personalDataFilesList[pdfl], { fetch: sessionid.fetch });

        const personalDataFileThing = getThing(personalDataFile, personalDataFilesList[pdfl]);

        const targetDataURL = getUrlAll(personalDataFileThing, RDF.type);

        const categoryIndex = targetDataURL.findIndex(element => element.includes("dpv"));

        if(categoryIndex > -1){
        console.log("TargetDataURl \n" + targetDataURL);
        console.log(targetDataURL[categoryIndex].split("#").pop());
        console.log("Creando resource to add "+personalDataFilesList[pdfl] );
        const resourceName = personalDataFilesList[pdfl].substring(personalDataFilesList[pdfl].lastIndexOf("/") + 1).length > 0 ? personalDataFilesList[pdfl].substring(personalDataFilesList[pdfl].lastIndexOf("/") + 1) : "Container ";
        var urlList = [personalDataFilesList[pdfl]];
        console.log(urlList);
        if(isContainer(personalDataFilesList[pdfl])){
            urlList = urlList.concat(getContainedResourceUrlAll(personalDataFile));
            for (var i = 1; i < urlList.length; i++){
              if(isContainer(urlList[i])){
                const dataset = await getSolidDataset(urlList[i], { fetch: sessionid.fetch });
                urlList = urlList.concat(getContainedResourceUrlAll(dataset, { fetch: sessionid.fetch }));
              }
            }
          }
        console.log(urlList);
        var resourceToAdd = {
           name: personalDataFilesList[pdfl],
           uri: urlList,
           categories: targetDataURL[categoryIndex].split("#").pop(),
           policies: [],
           recipients:[], //await getAgentAccessAll(personalDataFilesList[pdfl]),
           duration: "For as long as it is on the pod under a policy."
        };
        if(resourceToAdd.recipients.length > 0 ){
          processing = true;
        }
        //We deal with the policies that add permissions.

        for (var i = 0; i < policyListPermission.length; i++){
          const policyPermission = await getSolidDataset( policyListPermission[i], { fetch: sessionid.fetch });
          const policyPermissionThing = `${policyListPermission[i]}#permission1`
          const thing = getThing( policyPermission, policyPermissionThing);
          // get category of data targeted by the policy
          console.log("get category of data targeted by the permission policy.");

          const targetDataPolicy = getUrlAll(thing, ODRL.target);

          //Comprobamos si la categoria de la politica y la del fichero son la misma o si la categoria del fichero es una subcategoria de la de la politica.
            if((targetDataURL[categoryIndex].split("#").pop() == targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)) || getParent(myJsonCat,targetDataURL[categoryIndex].split("#").pop()).parents.includes(targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1))){

              var policy = {
                polName:  policyListPermission[i].substring(policyListPermission[i].lastIndexOf("/") + 1) +" gives permission for category: " + targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1),
                purpose: "",
                action: "",
              };

              const purposeConstraintThing = `${policyListPermission[i]}#purposeConstraint`;
              const purposeThing = getThing( policyPermission, purposeConstraintThing);
              const purposeData = getUrlAll(purposeThing, ODRL.rightOperand);
              console.log(purposeData);

              const actionData = getUrlAll(thing, ODRL.action);
              console.log(actionData);
              var purposeData2 = purposeData.map(function(d) {return d.replace('http://www.w3.org/ns/dpv#', '');})
              var actionData2 = actionData.map(function(d) {return d.replace('https://w3id.org/oac/', '');})
              policy.purpose = purposeData2;
              policy.action = actionData2;
              console.log(policy);
              resourceToAdd.policies.push(policy);
            }

        }

        //We deal with the Prohibitions
        for (var i = 0; i < policyListProhibition.length; i++){
          const policyProhibition = await getSolidDataset( policyListProhibition[i], { fetch: sessionid.fetch });
          const policyProhibitionThing = `${policyListProhibition[i]}#prohibition1`
          const thing = getThing( policyProhibition, policyProhibitionThing);
          // get category of data targeted by the policy
          console.log("get category of data targeted by the prohibition policy.");

          const targetDataPolicy = getUrlAll(thing, ODRL.target);

          //Comprobamos si la categoria de la politica y la del fichero son la misma o si la categoria del fichero es una subcategoria de la de la politica.
            if((targetDataURL[categoryIndex].split("#").pop() == targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)) || getParent(myJsonCat,targetDataURL[categoryIndex].split("#").pop()).parents.includes(targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1))){

              var policy = {
                polName:  policyListProhibition[i].substring(policyListPermission[i].lastIndexOf("/") + 1) +" gives prohibition for category: " + targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1),
                purpose: "",
                action: "",
              };

              const purposeConstraintThing = `${policyListProhibition[i]}#purposeConstraint`;
              const purposeThing = getThing( policyProhibition, purposeConstraintThing);
              const purposeData = getUrlAll(purposeThing, ODRL.rightOperand);
              console.log(purposeData);

              const actionData = getUrlAll(thing, ODRL.action);
              console.log(actionData);
              var purposeData2 = purposeData.map(function(d) {return d.replace('http://www.w3.org/ns/dpv#', '');})
              var actionData2 = actionData.map(function(d) {return d.replace('https://w3id.org/oac/', '');})
              policy.purpose = purposeData2;
              policy.action = actionData2;
              console.log(policy);
              resourceToAdd.policies.push(policy);
            }

        }
      /*
        for (var i = 0; i < policyListProhibition.length; i++){

          const policyProhibition = await getSolidDataset( policyListProhibition[i], { fetch: sessionid.fetch });
          const policyProhibitionThing = `${policyListProhibition[i]}#prohibition1`;
          const thing = getThing( policyProhibition, policyProhibitionThing);
          const targetDataPolicy = getUrlAll(thing, ODRL.target);
          const purposeConstraintThing = `${policyListProhibition[i]}#purposeConstraint`;
          const purposeThing = getThing( policyProhibition, purposeConstraintThing);
          const purposeData = getUrlAll(purposeThing, ODRL.rightOperand);
          const actionData = getUrlAll(thing, ODRL.action);

          // get category of data targeted by the policy
          console.log("get category of data targeted by the prohibition policy.");


          const element = targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1);
          console.log(purposeData);
          for (var j = 0; j < resourceToAdd.policies.length; j++) {
            console.log("Entered for: "+j);
            console.log("Target del archivo: " +targetDataURL[0].split("#").pop());
            console.log("Target de la policy: " +targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1) );
            console.log(targetDataURL[0].split("#").pop() == targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1));
            console.log(getParent(myJsonCat,targetDataURL[0].split("#").pop()).parents.includes(targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)));
            //Comprobamos si las categorias de los archivos son iguales
            if((targetDataURL[0].split("#").pop() ==  targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1)) || getParent(myJsonCat,targetDataURL[0].split("#").pop()).parents.includes(targetDataPolicy[0].substring(targetDataPolicy[0].lastIndexOf("/") + 1))){
              console.log("Categories are the same so we check for something prohibited here." + j);

              //console.log(resourceToAdd.policies[j].purpose);
              //console.log(resourceToAdd.policies[j].purpose.split("#").pop());
              //console.log(getParent(myJsonPur,resourceToAdd.policies[j].purpose.split("#").pop()));
              if(purposeData.some((e) => resourceToAdd.policies[j].purpose.includes(e) || getParent(myJsonPur,resourceToAdd.policies[j].purpose.split("#").pop()).parents.includes(e.split("#").pop()) )  ){

                console.log("We have something prohibited here.");
                console.log(resourceToAdd.policies[j].action);
                console.log(actionData);
                resourceToAdd.policies[j].action = resourceToAdd.policies[j].action.split(",").filter(val => !actionData.includes(val)).toString();
                console.log(resourceToAdd.policies[j].action);
            }
          }

        }
        console.log("Out of " + j +" policy");
      }
      */

        if(resourceToAdd.policies.length > 0 ){
          console.log(resourceToAdd);
          result.format.resource.push(resourceToAdd);
        }
      }

      }

    }
    }
    catch{
      res.status(500)
      if(sessionid === undefined){
        result = `You need to log in.`

      }
    }
    console.log(result);


    res.send(result);

});


  app.listen(port, () => {
  console.log(
    `Server running on port [${port}]. ` +
    `Visit [http://localhost:${port}/login] to log in to [broker.pod.inrupt.com].`
  );
});
