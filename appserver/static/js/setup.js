$(document).ready(function() {
    "use strict";
    // 0) global vars
    // FIXME for the ebox_id, it will be different from TA to TA.
    var allSettingsEboxId = "#\\/Splunk_TA_paloalto_input_setup\\/Splunk_TA_paloalto_settings\\/Splunk_TA_paloalto_settings\\/all_settings_id";
    var userDelete = [];
    var userEdit = 0;
    var appname = Splunk.util.getCurrentApp();
    // 1) Load dependent css and javascript
    $("<link>").attr({
        rel: "stylesheet",
        type: "text/css",
        href: "/en-US/static/app/" + appname + "/css/setup.css"
    }).appendTo("head");
    // 2) Append new html
    var originFormWrapper = $(".entityEditForm");
    originFormWrapper.css("display", "none");
    originFormWrapper.before(return_page());

    var currentAction = "New";
    var tables = {};
    var dialogs = {};

    function htmlEscape(str) {
        return String(str)
                   .replace(/&/g, '&amp;')
                   .replace(/"/g, '&quot;')
                   .replace(/'/g, '&#39;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;');
    }

    function htmlUnescape(value){
        return String(value)
                   .replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'")
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&amp;/g, '&');
    }

    function isTrue(value) {
        if (value === undefined) {
            return 0;
        }
        value = value.toUpperCase();
        var trues = ["1", "TRUE", "T", "Y", "YES"];
        return trues.indexOf(value) >= 0;
    }

    function setCheckBox(boxId, value) {
        if (value === undefined) {
            value = "0";
        }
        value = value.toLowerCase();
        if (value == "1" || value == "true" || value == "yes") {
            $("#" + boxId).prop("checked", true);
        } else {
            $("#" + boxId).prop("checked", false);
        }
    }


    function updateGlobalSettings(settings) {
        // Global settings
        if (settings.global_settings === undefined) {
            return;
        }
        $("#log_level_id").val(settings.global_settings.log_level);
    }

    var passwordColumns = [{
        id: "username",
        name: "Username",
        name_with_desc: "The username of the user account*",
        required: "required",
        hide: false,
        type: 'text',
        dialogHide: false
    }, {
        id: "password",
        name: "Account Password",
        name_with_desc: "The password of the user account*",
        required: "required",
        hide: true,
        type: 'password',
        dialogHide: false
    }];

    function updateCredentialSettings(cols, credentialSettings) {
        var creds = [];
        var credsMap = {};
        if (credentialSettings) {
            $.each( credentialSettings, function( k, value ) {
                // if (isTrue(credentialSettings[k].removed)) {
                //     continue;
                // }
                var rec = [k];
                for ( var i = 1; i < cols.length; i++ ) {
                    var val = credentialSettings[k];
                    if (val === undefined || val == null) {
                        val = "";
                    }
                    rec.push(val);
                }
                creds.push(rec);
                credsMap[k] = rec;
            });
        }
        return {
            "data": creds,
            "dataMap": credsMap,
        };
    }

    //Get SETTINGS using Splunk REST Endpoints
    $.ajax({
        url: "/en-US/splunkd/__raw/servicesNS/-/Splunk_TA_paloalto/storage/passwords/",
        data: {
            "output_mode": "json"
        },
        type: "GET",
        dataType : "json",
    }).done(function(response) {
        var customized_settings = {};
        var credential_settings = {};
        for(var i = 0; i < response.entry.length; i++) {
            var name = response.entry[i].name;
            var array = name.split(":");
            if(array[0] === "Splunk_TA_paloalto") {
                if(array[1] === "autofocus_api_key" || array[1] === "wildfire_api_key") {
                    var clearText = response.entry[i].content.clear_password;
                    clearText = clearText.replace('password``splunk_cred_sep``','');
                    customized_settings[array[1]] = clearText;
                } else {
                    var clearText = response.entry[i].content.clear_password;
                    clearText = clearText.replace('password``splunk_cred_sep``','');
                    credential_settings[array[1]] = clearText;
                }
            }
        }
        var allSettings = {customized_settings, credential_settings};
        // console.log(allSettings);
        // parse the data
        // updateGlobalSettings(allSettings);
        updateCustomizedSettings(allSettings);
        var passwordCreds = updateCredentialSettings(passwordColumns, allSettings.credential_settings);
        tables = {
            "passwordCredTable": {
                "id": "passwordCredTable",
                "columns": passwordColumns,
                "data": passwordCreds.data,
                "dataMap": passwordCreds.dataMap,
            },
        };
        dialogs = {
            "passwordCredDialog": {
                "id": "passwordCredDialog",
                "btnId": "passwordBtnAdd",
                "formId": "passwordCredForm",
                "table": tables.passwordCredTable,
            },
        };
        for (var dialogId in dialogs) {
            enjectDialogForm(dialogId, dialogs[dialogId].formId, dialogs[dialogId].table.columns);
            registerBtnClickHandler(dialogId);
        }
        for (var tableId in tables) {
            updateHeaders(tableId, tables[tableId].columns);
            hideColumns(tableId, tables[tableId].columns);
            updateTable(tableId, tables[tableId].data, tables[tableId].columns); }
        for (var dialogId in dialogs) {
            $("#" + dialogs[dialogId].formId).submit(submitHandler);
            $("#" + dialogs[dialogId].formId + " input").off("keypress").keypress(dialogId, function(e) {
                if (e.which == 13) {
                    $("#" + e.data + "BtnSave").click();
                    return false;
                }
            });
        }
    }).fail(function(xhr, status, response) {
        $('#load_err_banner').show();
        $('#save_err_banner').hide();
        $('#info_banner').hide();
        // console.log(status, response);
    });

    function showDialog(dialogId){
        $("." + dialogId).css("display", "block");
        $(".shadow").css("display", "block");
    }

    function hideDialog(dialogId){
        $("." + dialogId).css("display", "none");
        $(".shadow").css("display", "none");
    }

    function hideDialogHandler(e){
        var btnIdToDialogId = {
            "passwordCredDialogBtnCancel": "passwordCredDialog",
        };
        hideDialog(btnIdToDialogId[e.target.id]);
    }

    function enjectDialogForm(dialogId, formId, cols) {
        var form = $("#" + formId);
        cols.forEach(function(column){
            if (column.dialogHide) {
                return;
            }
            var container = $("<div></div>");
            var label = $("<label for='" + column.id + "'>" + column.name_with_desc + "</label>");
            var type = "text";
            if (column.type == "password") {
                type = "password";
            }
            var input = $("<input type='" + type + "' name='" + column.name_with_desc + "' id='" + column.id + "' " + column.required + "/>");
            container.append(label);
            container.append(input);
            form.append(container);
            form.append("<br><br>");
        });
        var container = $('<div style="display: inline;"></div>');
        var saveBtnId = dialogId + "BtnSave";
        var cancelBtnId = dialogId + "BtnCancel";
        container.append($("<input id='" + saveBtnId + "' type='submit' value='Save'/>"));
        container.append($("<input id='" + cancelBtnId + "' type='button' value='Cancel'/>"));
        form.append(container);
        $("#" + cancelBtnId).click(hideDialogHandler);
    }

    function registerBtnClickHandler(did) {
        $("#" + dialogs[did].btnId).click(function(){
            currentAction = "New";
            var table = dialogs[did]["table"];
            $("input#" + table.columns[0].id).prop("readonly", false);
            table.columns.forEach(function(c, j){
                $("input#" + c.id).val("");
            });
            $("input#" + table.columns[0].id).css("background-color", "rgb(255, 255, 255)");
            var dialog = $("#" + did);
            var saveBtnId = did + "BtnSave";
            dialog.text(dialog.text().replace("Edit", "Add"));
            showDialog(did);
        });
    }

    function clearFlag() {
        $("table thead td span").each(function(){
            $(this).removeClass("asque");
            $(this).removeClass("desque");
        });
    }

    function submitForm(formId) {
        var formIdToDialog = {

            "passwordCredForm": dialogs.passwordCredDialog,
        }
        var dialog = formIdToDialog[formId];
        var label = $("label[for='" + dialog.table.columns[0].id + "']");
        label.text(dialog.table.columns[0].name + ": ");
        label.css("color", "black");
        var row = [];
        dialog.table.columns.forEach(function(c, i){
            row[i] = $("#" + c.id).val();
        });
        // if (row[0] in dialog.table.dataMap && currentAction == "New") {
        //     label.text(dialog.table.columns[0].name + ": " + row[0] + " already exists");
        //     label.css("color", "red");
        //     return;
        // }
        if (currentAction == "Edit") {
            for (var i = 0; i < dialog.table.data.length; i++) {
                if (dialog.table.data[i][0] == row[0]) {
                    dialog.table.data[i] = row;
                    break;
                }
            }
        } else {
            dialog.table.data.push(row);
        }

        dialog.table.dataMap[row[0]] = row;
        updateTable(dialog.table.id, dialog.table.data, dialog.table.columns);
        hideDialog(dialog.id);
        clearFlag();
    }

    function submitHandler(event) {
        var formId = event.target.id;
        submitForm(formId);
        event.preventDefault();
    }

    setTimeout(function() {
        for (var dialogId in dialogs) {
            $("#" + dialogs[dialogId].formId).submit(submitHandler);
            $("#" + dialogs[dialogId].formId + " input").off("keypress").keypress(dialogId, function(e) {
                if (e.which == 13) {
                    $("#" + e.data + "BtnSave").click();
                    return false;
                }
            });
        }
    }, 3000);

    function hideColumns(tableId, cols) {
        for (var i = 0; i < cols.length; i++) {
            if (cols[i].hide) {
                $("#" + tableId + " td:nth-child(" + (i + 1) + "),th:nth-child(" + i + ")").hide();
            }
        }
    }

    function updateHeaders(tableId, cols){
        var theadTr = $("#" + tableId + " .tableHead>tr");
        cols.forEach(function(col, i){
            var td = $("<td><span data-idx='" + i + "'>" + col.name+"</span></td>");
            theadTr.append(td);
        });
        var td = $("<td><span data-idx='" + cols.length + "'>Action</span></td>");
        theadTr.append(td);
        hideColumns(tableId, cols);
    }

    function editRow(e) {
        currentAction = "Edit";
        userEdit = 1;
        var rowIdAndTableId = e.target.id.split("``");
        var table = tables[rowIdAndTableId[1]];
        var credName = $("input#" + table.columns[0].id);
        credName.prop("readonly", true);
        credName.css("background-color", "#D3D3D3");
        var did;
        for (var dialogId in dialogs) {
            if (dialogs[dialogId].table.id == table.id) {
                did = dialogId;
                break;
            }
        }
        var dialog = $("#" + did);
        dialog.text(dialog.text().replace("Add", "Edit"));
        showDialog(did);
        table.columns.forEach(function(c, i){
            $("input#" + c.id).val(table.dataMap[rowIdAndTableId[0]][i]);
        });
        return false;
    }

    function deleteRow(e) {
        var rowIdAndTableId = e.target.id.split("``");
        var table = tables[rowIdAndTableId[1]];
        for (var i = 0; i < table.data.length; i++) {
            if (table.data[i][0] == rowIdAndTableId[0]) {
                table.data.splice(i, 1);
                userDelete.push(rowIdAndTableId[0]);
                delete table.dataMap[rowIdAndTableId[0]];
                break;
            }
        }
        updateTable(table.id, table.data, table.columns);
        return false;
    }

    function updateTable(tableId, tableData, cols) {
        if (!tableData) {
            return;
        }
        var tableLength = tableData.length;
        // console.log("ROW COUNT: " + tableLength);
        if(tableLength >= 1) {
            $('#passwordBtnAdd').hide();
        } else {
            $('#passwordBtnAdd').show();
        }
        if(tableLength > 1) {
            return;
        }
        var tbody = $("#" + tableId + " .tableBody");
        tbody.empty();
        tableData.forEach(function(row){
            var tr = $("<tr></tr>");
            row.forEach(function(cell){
                var td = $("<td>" + cell + "</td>");
                tr.append(td);
            });
            var id = row[0] + "``" + tableId;
            var remove_hyperlink_cell= $("<a>", {
                "href": "#",
                "id": id,
                click: deleteRow,
            }).append("Delete");
            var edit_hyperlink_cell= $("<a>", {
                "href": "#",
                "id": id,
                click: editRow,
            }).append("Edit");
            var td = $("<td>").append(remove_hyperlink_cell).append(" | ").append(edit_hyperlink_cell);
            tr.append(td);
            tbody.append(tr);
        });
        hideColumns(tableId, cols);
    }

    // for (var tableId in tables) {
    //     updateHeaders(tableId, tables[tableId].columns);
    //     hideColumns(tableId, tables[tableId].columns);
    //     updateTable(tableId, tables[tableId].data, tables[tableId].columns);
    // }

    function updateCustomizedSettings(settings) {
        if (settings.customized_settings === undefined) {
            return;
        }
        if (settings.customized_settings["wildfire_api_key"]){
            $("#wildfire_api_key_id").val(settings["customized_settings"]["wildfire_api_key"]);
        }
        if (settings.customized_settings["autofocus_api_key"]){
            $("#autofocus_api_key_id").val(settings["customized_settings"]["autofocus_api_key"]);
        }
    }

    // updateCustomizedSettings(allSettings);

    // Function to remove Firewall Api Key
    function removeFirewallAPIKey() {
        console.log("USer Edit/Delete called.");
        $.ajax({
            url:"/en-US/splunkd/__raw/servicesNS/-/Splunk_TA_paloalto/storage/passwords/%3Afirewall_api_key%3A",
            type: "DELETE"
        }).success(function() {
            console.log("Firewall API Key Deleted.");
            userEdit = 0;
            return;
        }).error(function() {
            console.log("Error");
            userEdit = 0;
            return;
        });
    }

    function getJSONResult() {
        var result = {};
        // Global Settings
        var log_level = $("#log_level_id").val();
        result["global_settings"] = {
            "log_level": log_level,
        };

        // Credential Settings
        var credSettings = {
            "credential_settings": tables.passwordCredTable,
        }
        for (var k in credSettings) {
            result[k] = {};
            var credTable = credSettings[k];
            for (var i = 0; i < credTable.data.length; i++){
                var temp = {};
                credTable.columns.forEach(function(c, j){
                    temp[c.id] = credTable.data[i][j];
                });
                result[k][temp[credTable.columns[0].id]] = temp;
                delete temp[credTable.columns[0].id];
            }
        }

        // Customized Settings
        var check_dict = {true:1, false:0};
        var user_defined_settings = {
            "wildfire_api_key": {
                "type": "password",
                "password": $("#wildfire_api_key_id").val()
            },
            "autofocus_api_key": {
                "type": "password",
                "password": $("#autofocus_api_key_id").val()
            },
        };
        result["customized_settings"] = user_defined_settings;
        return result;
    }

    $(".my-btn-primary").click(function(){
        $(".splButton-primary").click();
    });
    $(".my-btn-secondary").click(function(){
        window.location = "../../../../search/apps/local";
    });
    setInterval(function(){
        $(".my-btn-primary span").html($(".splButton-primary span").html());
    }, 50);
    $(".splButton-primary").on("click", function(){
        if(userDelete.length > 0) {
           for (var i = 0; i < userDelete.length; i++) {
               $.ajax({
                    url:"/en-US/splunkd/__raw/servicesNS/-/Splunk_TA_paloalto/storage/passwords/Splunk_TA_paloalto%3A" + userDelete[i] + "%3A",
                    type: "DELETE",
                }).success(function() {
                    console.log(userDelete);
                    console.log('User ' + userDelete[i] + ' deleted.');
                    userDelete.splice(0, 1);
                    console.log(userDelete);
                }).error(function() {
                    console.log('User ' + userDelete[i] + ' Not Found.');
                });
            }
        }
        console.log(userEdit);
        if(userEdit == 1 || userDelete.length > 0) {
           removeFirewallAPIKey();
        }
        var jsonResult = JSON.stringify(getJSONResult());
        $(allSettingsEboxId).val(jsonResult);
    });
});