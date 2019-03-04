# OpenAPI Doc browser 
Convenient documentation of REST applications with Open API (swagger 2.0) documentation features.

Currently supports json schema files and json return format.
## Usage
Recommended browser: Chrome, or other browsers that have a "save as PDF" feature.

Enter the URL for the json documentation file at the top of the page ("Open API URL"), and hit the "Reload" button at the right.

The browser will fill up with documentation for the whole service, laid out as:
### Controller
#### Path (get/post/put/...)
##### Input parameters (#parameters)
* name, type (description when available)
* ...

Required parameters will be in bold font, query parameters will be in italics.
##### Returns
[Array of] _Link to type definition when applicable_, OR _the actual json description_, e.g. ```{"type": "boolean"}```
### Type definitions
#### Type name
 |
- | -
Property name, e.g. AccountID | Property type, e.g. number [(format descriptor, e.g. double)]

# Example:
## Account
### /accounts/\{name\}/movements (get)
#### Input parameters (3):
• __name__,  string     
• from,  string   (date-time)  
• to,  string   (date-time)  
#### Returns:
Array of [DeBIP.Services.CoreAPI.Contract.Agreement.AccountMovement]()
## Type definitions
### DeBIP.Services.CoreAPI.Contract.Agreement.AccountMovement 
 |
- | -
PosAmount | number (double)
NegAmount | number (double)
TransactionBookDate |string (date-time)
TransactionAmount | number (double)
AccountBalance | number (double)
Description | string
TransactionSequence | integer (int32)
InvoiceNumber | string

__NOTE:__ If a property type is an instance of another object type definition, the property name will be a navigation link to that type. The Property type will nest down to the schema definition (properties) for the referenced type.

If a property type is an enum, the members will be listed, e.g. "string (enum: [Due,Paid])"

# Exclusion of paths / methods / type definitions
You may specify an exclusion list in the file: 'data/\{titleofservice\}-excludes.json'. Title of service can be found in the json doc, in the property info.title. The syntax of the exclude file should be:
```{ "controller": ["Test"], "path": ["PingMe"], "type": ["Integration.TestClasses"], }```, where all the arrays should contain strings. Please note that the "type" exclusion implements "typename.startsWith()", to all for exclusion of entire namespaces.
In the example, the controller "Test" / "TestController" will be omitted, the method name "PingMe" in all controllers will be omitted, and all types with names starting with "Integration.TestClasses" will be omitted.

__DISCLAIMER:__ This software was written out of necessity. A customer insisted on being able to PRINT the documentation, although they have access to the swagger UI, which delivers the same documentation in even more detail, but does not lend itself to paper production in a straightforward way.
As such, only the bare minimum of what was needed has been implemented in this version. 
There may well be features / varities of the Open API model that are not supported, and this may cause parsing/binding errors.

# Printing / saving as PDF
All browsers seem to handle this differently, and some not at all. Edge and IE lacks "Save as PDF", but is able to "Print" to installed drivers, so drivers like "cutePDF", "Microsoft Print to PDF", and "PDF Creator" will work.
Chrome's "Save as PDF" works much better. HIt "print", "Save as PDF", an you get a PDF document with working links.

