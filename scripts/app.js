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

        var buildTypeList = function () {
            model.GetTypeList = function () {
                var allTypes = Object.keys(model.definitions);
                return allTypes.filter(function (e) {
                    if (excludes["type"].find(function (n) { return e.startsWith(n); }))
                        return false;
                    var definition = model.definitions[e];
                    for (let propName in definition.properties) {
                        let prop = definition.properties[propName];
                        prop.extraDescr = function () {
                            return "";
                        }
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
                    }
                    return true;
                });
            };
        };
        buildControllersLevel();
        buildTypeList();
    }

    function loadData() {
        $("#load-spinner").show();
        $("#api-doc").empty();

        function appHtmlSuccessfullyLoaded() {
            $.getJSON(window.location.origin + window.location.pathname + "data/" + model.info.title + "-excludes.json", null,
                function (data, textStatus, jqXHR) {
                    excludes = data;
                }
            ).always(function () {
                prepareModel();
                ko.applyBindings(model, $("#api-doc")[0]);
                $("#api-doc").show();
            });
            
        }

        function jsonDocSuccessfullyLoaded(data, textStatus, jqXHR) {
            model = data;
            if (model && model.paths) {
                $("#app").load(window.location.origin + window.location.pathname + "views/app.html", appHtmlSuccessfullyLoaded);
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

    $("#download-btn").click();
});