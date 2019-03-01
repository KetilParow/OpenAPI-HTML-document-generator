$(function () {
    let model = null;
    $("#api-doc").hide();
    function processModel() {
        if (!model) { return; }
        var excludeControllers = ["Morten"];
        var excludePathNames = ["Ping"];
        var excludeTypeNamespaces = ["banqsoft.com.schemas.services.v2","DeBIP.Services.Common.DiagnosisResult"];

        model.controllers = {};
        
        Object.keys(model.paths).forEach(function (key) {
            let path = model.paths[key];
            
            Object.keys(path).forEach(function (methodName) {
                let method = path[methodName];
                let controller = method.tags[0];

                if (excludeControllers.find(function (e) { return e == controller })) {
                    return;
                }

                if (excludePathNames.find(function (p) { return controller + "_" + p == method.operationId; })) {
                    return;
                }

                if (model.controllers[controller] && model.controllers[controller][key]) {
                    return;
                }

                if (!model.controllers[controller]) {
                    model.controllers[controller] = {};
                }
                model.controllers[controller][key]=path;
            });
            
            model.GetTypeList = function () {
                var allTypes = Object.keys(model.definitions);
                return allTypes.filter(function (e) {
                    if (excludeTypeNamespaces.find(function (n) { return e.startsWith(n); }))
                        return false;
                    return true;
                })
            }
        }); 
    }

    function loadData() {
        $("#api-doc").hide();
        $("#load-spinner").show();
        $.getJSON($("#api-url").val(), null,
            function (data, textStatus, jqXHR) {
                let isBound = model && model.isBound;
                model = data;
                model.isBound = isBound;
                if (model && model.paths) {
                    processModel();
                    if (!model.isBound) {
                        ko.applyBindings(model, $("#api-doc")[0]);
                    }
                    model.isBound = true;
                    $("#api-doc").show();
                    $("#load-spinner").hide();
                }
            }
        );
    }

    $("#download-btn").on("click", function () {
        if ($("#api-url").val()) {
            loadData();
        }
    });

    $("#download-btn").click();
});