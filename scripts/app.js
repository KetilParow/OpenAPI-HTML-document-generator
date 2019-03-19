//For those who still think they need IE:
//IE fixing...
if (!Array.find) {
    Array.prototype.find = function (delegate) {
        for (let i = 0; i < this.length; i++) {
            let e = this[i];
            if (delegate(e)) {
                return e;
            }
        }
        return null;
    };
}
if (!String.startsWith) {
    String.prototype.startsWith = function (s) {
        return this.indexOf(s) == 0;
    };
}

//------------------
// /IE fixing...
//-------------------

//------------------
//Utils

if (!Location.appRoot) {
    Location.prototype.appRoot = function () {
        let arr = this.pathname.split("/");
        arr[arr.length - 1] = "";
        return this.origin + arr.join("/");
    }
}

// /Utils
//------------------


$(function () {
    let model = null;
    let excludes = { "controller": [], "path": [], "type": [], };

    $("#api-doc").hide();
    
    function prepareModel() {
        if (!model) { return; }
        
        var addDefaultSchemaHelpers = function (object) {
            object.typeReference = function () {
                return null;
            }
            object.typeDescr = function () {
                return null;
            }

            object.isArray = function () {
                return false;
            }
        };

        var overrideSchemaHelpers = function (pObject, schema) {
            schema = schema || pObject;
            if (schema["type"] && schema["type"] === "array") {
                pObject.isArray = function () {
                    return true;
                }
            }
            if (schema["$ref"] || schema["items"] && schema["items"]["$ref"]) {
                if (pObject != schema) {
                    model.referencedTypes.push((schema["$ref"] || schema["items"]["$ref"]).replace("#/definitions/", ""));
                }
                pObject.typeReference = function () {                    
                    return (schema["$ref"] || schema["items"]["$ref"]);
                }
            }
            else {
                pObject.typeDescr = function () {
                    return JSON.stringify(schema);
                }
            }
        }

        var AddSchemaHelpers = function (method) {
            addDefaultSchemaHelpers(method);

            method.hasReturnSchema = function () {
                return false;
            }
            if (method.responses && method.responses["200"] && method.responses["200"].schema) {
                method.hasReturnSchema = function () {
                    return true;
                }
                let schema = method.responses["200"].schema;
                overrideSchemaHelpers(method, schema);
                
            }
        }

        var buildControllersLevel = function () {
            model.controllers = {};
            model.referencedTypes = [];
            Object.keys(model.paths).forEach(function (key) {
                let path = model.paths[key];
                Object.keys(path).forEach(function (methodName) {
                    let method = path[methodName];
                    let controller = method.tags[0];

                    if (excludes["controller"].find(function (e) { return e == controller })) {
                        return;
                    }

                    if (excludes["path"].find(function (p) { return controller + "_" + p == method.operationId; })) {
                        return;
                    }

                    AddSchemaHelpers(method);

                    if (!model.controllers[controller]) {
                        model.controllers[controller] = {};
                    }

                    if (model.controllers[controller][key]) {
                        return;
                    }
                    model.controllers[controller][key] = path;
                });
            });
        }

        function LoopThthroPropertiesOfDefinition(definition) {
            for (let propName in definition.properties) {
                let prop = definition.properties[propName];
                prop.extraDescr = function () {
                    return "";
                };
                prop.name = propName;
                addDefaultSchemaHelpers(prop);
                overrideSchemaHelpers(prop);
                if (!prop.typeReference()) {
                    var extraDescr = "";
                    if (prop["enum"]) {
                        extraDescr = extraDescr + "(enum: [" + prop["enum"].toString() + "])";
                    }
                    if (prop["format"]) {
                        extraDescr = extraDescr + "(" + prop.format + ")";
                    }
                    prop.extraDescr = extraDescr;
                    prop.typeDescr = function () { return prop["type"]; };
                }
                else {
                    var refTypename = prop.typeReference().replace("#/definitions/", "");
                    if (!model.definitionIsReferenced(refTypename)) {
                        var refType = model.definitions[refTypename];
                        if (refType.name) {
                            continue;
                        }
                        LoopThthroPropertiesOfDefinition(refType);
                        refType.name = refTypename;
                    }
                }
            }
        }

        function buildTypeList() {
            model.definitionIsReferenced = function (name) {
                return model.referencedTypes.indexOf(name) >= 0;
            };

            let allTypes = Object.keys(model.definitions);
            model.typeList = allTypes.filter(function (e) {
                if (excludes["type"].find(function (n) { return e === n; }) ||
                    (!model.definitionIsReferenced(e) && excludes["type"].find(function (n) { return e.startsWith(n); })))
                    return false;
                var definition = model.definitions[e];
                if (!definition.name) {
                    LoopThthroPropertiesOfDefinition(definition);
                    definition.name = e; //convenience, and  marker for processed.
                }
                return true;
            });
            model.typeRefIsInTypelist = function (typeName) {
                return model.typeList.indexOf(typeName.replace("#/definitions/", "")) >= 0;
            };
                
        };
        buildControllersLevel();
        buildTypeList();        
    }

    function loadData() {
        $("#load-spinner").show();
        $("#api-doc").empty();

        function appHtmlSuccessfullyLoaded() {
            $.getJSON(window.location.appRoot() + "data/" + model.info.title + "-excludes.json", null,
                function (data) {
                    excludes = data;
                }
            ).always(function () {
                prepareModel();
                ko.applyBindings(model, $("#api-doc")[0]);
                $("#api-doc").show();
            });
            
        }

        function jsonDocSuccessfullyLoaded(data) {
            model = data;
            if (model && model.paths) {
                $("#app").load(window.location.appRoot() + "views/app.html", appHtmlSuccessfullyLoaded);
            }
        }
 
        $.getJSON($("#api-url").val(), null, jsonDocSuccessfullyLoaded)
            .always(function () {
                $("#load-spinner").hide();
                }).fail(function (jqXHR, textStatus, errorThrown) {
                    let $m = $("#errormsg-modal");
                    $m.find("#errormsgModalLabel").html("Error: " + (textStatus.toLocaleLowerCase() != "error" ? textStatus + " " : "") + errorThrown);
                    $m.find(".modal-body").html("<code>" + jqXHR.responseText + "</code>");
                    $m.modal();
                });
        }

    $("#download-btn").on("click", function () {
        if ($("#api-url").val()) {
            loadData();
        }
    });

    $("#api-url").on("change", function () {
        if (!$(this).val()) {
            $("#download-btn").prop("disabled", "disabled");
        }
        else {
            $("#download-btn").prop("disabled", false);
        }
        
    });

    $.getJSON(window.location.appRoot() + "data/config.json", null,
        function (data) {
            $("#api-url").val(data.defaultUrl);
            $("#api-url").change();
            $("#download-btn").click();
        });
});