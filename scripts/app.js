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
    let settings = {};
    
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
                let extraDescr = "";
                //Default the type descr to the raw json...
                pObject.typeDescr = function () {
                    if (schema["format"] === "binary" && schema["type"] === "file") {
                        return "Binary stream (file attachment)";
                    }
                    if (schema["format"] && schema["type"]) {
                        return schema.type + " (" + schema.format + ")";
                    }
                    if (schema["type"]) {
                        return schema.type;
                    }
                    return JSON.stringify(schema);
                }

                if (pObject["enum"]) {
                    extraDescr = extraDescr + "(enum: [" + pObject["enum"].toString().replace(/,/g, ", ") + "])";
                }
                if (pObject["format"]) {
                    extraDescr = extraDescr + "(" + pObject.format + ")";
                }
                pObject.extraDescr = extraDescr;
                //if extraDescr describes the type adequately, set typeDescr to simple description
                if (extraDescr) {
                    pObject.typeDescr = function () { return pObject["type"]; };
                }
            }
        }

        var AddSchemaHelpers = function (method) {
            addDefaultSchemaHelpers(method);

            method.has200Return = function () {
                return false;
            }
            if (method.responses && method.responses["200"] && method.responses["200"].schema) {
                method.has200Return = function () {
                    return true;
                }
                let schema = method.responses["200"].schema;
                overrideSchemaHelpers(method, schema);
            }
            if (!method.parameters || method.parameters.length == 0) {
                return;
            }
            method.parameters.forEach(function (p) {
                addDefaultSchemaHelpers(p);
                overrideSchemaHelpers(p, p.schema);
            });
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
                    prop.typeDescr = function () { //Want no json in property type descr.
                        return prop["type"];
                    }                    
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
                if (settings.initialCollapse) {
                    $("#collapse-btn").click();
                }
                $("#load-spinner").hide();
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
                
            }).fail(function (jqXHR, textStatus, errorThrown) {
                $("#load-spinner").hide();
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
    $("#help-btn").on("click", function () {
        $.ajax({
            url: "README.md",
            dataType: "text",
            success: function (data) {
                let converter = new showdown.Converter({ tables: true });
                let html = converter.makeHtml(data);
                let $m = $("#help-modal");
                $m.find(".modal-body").html(html);
                $m.modal();
            }
        });
    });

    $("#expand-btn").on("click", function () {
        $(".collapse").addClass("show");
    });

    $("#collapse-btn").on("click", function () {
        $(".collapse").removeClass("show");
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
            settings = data;
            $("#api-url").val(settings.defaultUrl);
            $("#api-url").change();
            $("#download-btn").click();
        });
});