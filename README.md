# TFM-API-express
 
 This project is being developed by me as part of my TFM project with the objective of providing an API to interact with an Inrupt pod in order to answer to Right of Access petitions.
 
# Libraries Used
@inrupt/solid-client-authn-node <br>
@inrupt/solid-client <br>
@inrupt/vocab-common-rdf <br>

cors <br>
express <br>
cookie-session <br>
swagger-ui-express <br>

# Getting started

To install the libraries use the command `npm install`

To start the API use the command `node index.js`

To change the port in which the API is listening, there is a const called port inside the index.js file.

In order to  log in: http://localhost:8000/login

In order to check the API's documentation go to: http://localhost:8000/api-docs/

Once logged in you can use the [TFM-Frontend](https://github.com/Rlongares/TFM-frontend) in order to make querys.



