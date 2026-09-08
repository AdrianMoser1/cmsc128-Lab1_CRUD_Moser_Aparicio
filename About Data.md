IMPORTANT!!!
- js localStorage and js sessionStorage are only allowed to store strings, so JSON format is needed. As such, functions that fetch data should only read strings 

(i.e. 
{
    "Task1": {
        "Name" : "String",
        "Description" : "String"
    }
})