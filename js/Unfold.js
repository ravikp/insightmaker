"use strict";

var unfoldingManager = {unfolding: false};

function beginUnfolding(){
	unfoldingManager.unfolding = true;
	unfoldingManager.init = getGraphXml(graph);
	initUnfolding();
}

function restartUnfolding(config){
	loadStoredUnfolding();
	if(config){
		saveUnfoldingStatus(config);
		unfoldingManager.init = getGraphXml(graph);
	}
	initUnfolding();
}

function saveUnfoldingStatus(config){

	var oldUnfolding = unfoldingManager.unfolding;
	unfoldingManager.unfolding = false;
	
    graph.getModel().beginUpdate();

    var edit = new mxCellAttributeChange(getSetting(), "unfolding", config.steps);
	graph.getModel().execute(edit);
    edit = new mxCellAttributeChange(getSetting(), "unfoldingStatus", config.enabled);
    graph.getModel().execute(edit);
    edit = new mxCellAttributeChange(getSetting(), "unfoldingAuto", config.auto);
    graph.getModel().execute(edit);
	
	graph.getModel().endUpdate();
	

	unfoldingManager.unfolding = oldUnfolding;
}

function finishUnfolding(){
	unfoldingManager.unfolding = false;
	loadStoredUnfolding();
}

function loadStoredUnfolding(){
	importMXGraph(unfoldingManager.init);
	if ((!is_editor) && (is_embed) && (is_zoom == 1)) {
		graph.getView().setScale(0.25);
		graph.fit();
		graph.fit();
	}
}

function initUnfolding(){
	unfoldingManager.steps = JSON.parse(getSetting().getAttribute("unfolding"));
	unfoldingManager.step = 0;
	Ext.getCmp("messageUnfoldBut").update("");
	Ext.getCmp("nextUnfoldBut").setDisabled(false);
	doUnfoldStep();
}

function doUnfoldStep(){
	if(unfoldingManager.steps.children.length > unfoldingManager.step){
		var action = unfoldingManager.steps.children[unfoldingManager.step];
		executeUnfoldAction(action);
		unfoldingManager.step++;
	}
	if(unfoldingManager.steps.children.length<=unfoldingManager.step){
		Ext.getCmp("nextUnfoldBut").setDisabled(true);
	}
}

function executeUnfoldAction(action){
	if(action.type=="group"){
		for(var i=0; i < action.children.length; i++){
			executeUnfoldAction(action.children[i]);
		}
	}else if(action.type=="note"){
		if(Ext.getCmp("messageUnfoldBut").getEl().down(".message")){
			Ext.getCmp("messageUnfoldBut").getEl().down(".message").fadeOut( {duration: 300});
			setTimeout(function(){
				Ext.getCmp("messageUnfoldBut").update("<div class='message'>"+action.data+"</div>");
			}, 400)
		}else{
			Ext.getCmp("messageUnfoldBut").update("<div class='message'>"+action.data+"</div>")
		}
		
	}else if(action.type=="visibility"){
		var data = JSON.parse(action.data)
		graph.getModel().beginUpdate();
		setOpacity(findID(data.ids).filter(function(x){return x!==null}), data.opacity);
		graph.getModel().endUpdate();
	}else if(action.type=="action"){
		runAction(action.data);
	}else if(action.type=="folder"){
		var data = JSON.parse(action.data)
		var folders = findID(data.ids).filter(function(x){return x!==null});
		if(data.mode=="expand"){
			expandFolder(folders);
		}else{
			collapseFolder(folders);
		}
	}else{
		alert("Unknown action!");
		console.log(action);
	}
}

var handleUnfoldToolbar = function(fromWin){
	var unfoldEnabled = getSetting().getAttribute("unfoldingStatus") == "on";
	var toolbar = Ext.getCmp("unfoldToolbar");
	
	if((! fromWin) || ((unfoldEnabled && toolbar.isHidden()) || ((! unfoldEnabled) && (! toolbar.isHidden())))){
		if(unfoldEnabled){
			toolbar.show();
		}else{
			toolbar.hide();
		}
	
		var should_unfold = false;
		var auto = getSetting().getAttribute("unfoldingAuto");
		if(isUndefined(auto)){
			auto = "non-editors";
		}
		if(auto != "never"){
			if(auto == "always"){
				should_unfold = true;
			}else if(is_embed && auto != "editors"){
				should_unfold = true;
			}else if(auto == "editors" && is_editor){
				should_unfold = true;
			}else if(auto == "non-editors" && (! is_editor)){
				should_unfold = true;
			}
		}

		revealUnfoldButtons(should_unfold);
		if(should_unfold && unfoldEnabled){
			beginUnfolding();
		}
	}
}

var revealUnfoldButtons = function(showUnfold){
	if(showUnfold){
		Ext.getCmp('unfoldUnfoldBut').hide();
		Ext.getCmp('reloadUnfoldBut').show();
		//if((! is_embed) && is_editor){
		Ext.getCmp('exitUnfoldBut').show();
		//}
		Ext.getCmp('messageUnfoldBut').show();
		Ext.getCmp('nextUnfoldBut').show();
	}else{
		Ext.getCmp('unfoldUnfoldBut').show();
		Ext.getCmp('reloadUnfoldBut').hide();
		Ext.getCmp('exitUnfoldBut').hide();
		Ext.getCmp('messageUnfoldBut').hide();
		Ext.getCmp('nextUnfoldBut').hide();
	}
}


function showUnfoldingWin(){
	var preventEdits = false;
	var mySetting = getSetting();
	
	function saveVisibility(){
		if(Ext.getCmp("opacitySlider")){
			var opacity = Ext.getCmp("opacitySlider").getValue();
			var ids = Ext.getCmp("unfoldingPrimitives").getValue();
			selectedNode.set("data", JSON.stringify({opacity: opacity, ids: ids}));
		}
	}
	
	function loadVisibility(){
		var data = JSON.parse(selectedNode.get("data"));
		 Ext.getCmp("opacitySlider").setValue(data.opacity);
		 Ext.getCmp("unfoldingPrimitives").setValue(data.ids);
	}
	
	function saveFolder(){
		if(Ext.getCmp("modeCombo")){
			var mode = Ext.getCmp("modeCombo").getValue();
			var ids = Ext.getCmp("unfoldingFolders").getValue();
			selectedNode.set("data", JSON.stringify({mode: mode, ids: ids}));
		}
	}
	
	function loadFolder(){
		var data = JSON.parse(selectedNode.get("data"));
		 Ext.getCmp("modeCombo").setValue(data.mode);
		 Ext.getCmp("unfoldingFolders").setValue(data.ids);
	}
	
	function storeToJson(includeFlag){
		var getJson = function(t) {
	          // Should deep copy so we don't affect the tree
	          var j = t.data;
			  var json = {text: j.text, data: j.data, type: j.type, leaf: j.leaf, expanded: j.expanded}
			  if(includeFlag){
				  json.flag = j.flag;
			  }

	          json.children = [];
	          for (var i=0; i < t.childNodes.length; i++) {
	              json.children.push( getJson( t.childNodes[i]) )
	          }
	          return json;
		  }
		  return getJson(treeStore.getRootNode());
	}
	
	function addNewNode(obj){
		var parent = tree.getRootNode();
		var index = parent.childNodes.length+1;
		if(selectedNode){
			if(selectedNode.get("type") == "group" && selectedNode.isExpanded()){
				parent = selectedNode;
				index = 0;
			}else{
				parent = selectedNode.parentNode;
				index = parent.indexOf(selectedNode)+1;
			}
		}
		var node = parent.insertChild(index, obj);
		tree.getSelectionModel().select(node);
	}
	
	var selectedNode;
	var treeStore = new Ext.data.TreeStore({
			fields: [{
				name: 'text',
				type: 'string'
			}, {
				name: 'type',
				type: 'string'
			}, {
				name: 'data',
				type: 'string'
			}, {
				name: 'flag',
				type: 'string'
			}],
		    proxy: {
		        type: 'memory'
		    }
        });
		if(mySetting.getAttribute("unfolding")){
			treeStore.setRootNode(JSON.parse(mySetting.getAttribute("unfolding")));
		}else{
			treeStore.setRootNode({
                text: 'Root Node',
				type: 'root',
                id: 'src',
                expanded: true
            });
		}
	var tree = Ext.create('Ext.tree.Panel', {
	    title: getText('Story Steps'),
		disabled: !(mySetting.getAttribute("unfoldingStatus")=="on"),
	    useArrows: true,
		flex: 1,
		rootVisible: false,
		id: "stepsTree",
        store: treeStore,
        viewConfig: {
            plugins: {
                ptype: 'treeviewdragdrop',
                containerScroll: true
            }
        },
	    listeners: {
	        select: {
	            fn: function(t, record, index, eOpts){
					//console.log("select");
					preventEdits = true;
					if(selectedNode){
						selectedNode.set("flag", "")
					}
					selectedNode = record;
	            	var type = selectedNode.get("type");
					selectedNode.set("flag", "selected");
					
					if(type == "visibility"){
						configs.getLayout().setActiveItem(1);
						loadVisibility();
					}else if(type == "note"){
						Ext.getCmp("actionNote").setValue(selectedNode.get("data"));
						configs.getLayout().setActiveItem(2);
					}else if(type == "action"){
						Ext.getCmp("actionCode").setValue(selectedNode.get("data"));
						configs.getLayout().setActiveItem(3);
					}else if(type == "group"){
						Ext.getCmp("groupName").setValue(selectedNode.get("text"));
						configs.getLayout().setActiveItem(4);
					}else if(type == "folder"){
						configs.getLayout().setActiveItem(5);
						loadFolder();
					}

					preventEdits = false;
	            }
	        }
	    },
        bbar: [{
			iconCls: 'units-remove-icon',
            text: getText('Remove'),
            scope: this,
            handler: function(){
				var json = storeToJson(true);
				
				function removeSelected(root){
					for(var i=0; i<root.children.length; i++){
						if(root.children[i].flag=="selected"){
							root.children.splice(i,1);
							i--;
						}else{
							removeSelected(root.children[i]);
						}
					}
				}
				
				removeSelected(json);
				treeStore.setRootNode(json);
				configs.getLayout().setActiveItem(0);
				
				selectedNode = null;
            }
			}, "->", {
			iconCls: 'units-add-icon',
            text: getText('Add Step'),
            scope: this,
			menu: {xtype: "menu",
				items: [{
			        text: getText('Change Visibility'),
					handler: function(){
						addNewNode({
							text: getText("Visibility Change"),
							data: "{\"opacity\": 100, \"ids\": []}",
							type: "visibility",
							leaf: true
						});
					}
			    },{
			        text: getText('Show Message'),
					handler: function(){
						addNewNode({
							text: getText("Show Message"),
							data: getText("Enter your message..."),
							type: "note",
							leaf: true
						});
					}
			    },{
			        text: getText('Toggle Folders'),
					handler: function(){
						addNewNode({
							text: getText("Toggle Folders"),
							data: "{\"mode\": \"expand\", \"ids\": []}",
							type: "folder",
							leaf: true
						});
					}
			    },
				'-',
				{
			        text: getText('Run Action'),
					handler: function(){
						addNewNode({
							text: getText("Run Action"),
							data: "",
							type: "action",
							leaf: true
						});
					}
			    },
				'-'
				,{
			        text: getText('Group Steps'),
					handler: function(){
						addNewNode({
							text: getText("New Group"),
							type: "group",
							leaf: false,
							expanded: true
						});
					}
			    }]
			}
        }]
    
    });
	
	
	
	var storeData = [];
	var prims = findAll();
	for (var i = 0; i < prims.length; i++) {
		var n = getName(prims[i]);
		storeData.push({
			pid: getID(prims[i]),
			pname: isDefined(n)?n:"--"
		});
	}
	
	//console.log(storeData)
	storeData.sort(function(a,b){
		return a.pname.localeCompare(b.pname);
	});
	
	var primitiveConfigStore = new Ext.data.JsonStore({
		fields: [{
			name: 'pid',
			type: 'string'
		}, {
			name: 'pname',
			type: 'string'
		}],
		data: storeData
	});
	
	storeData = [];
	prims = findType("Folder");
	for (var i = 0; i < prims.length; i++) {
		var n = getName(prims[i]);
		storeData.push({
			pid: getID(prims[i]),
			pname: isDefined(n)?n:"--"
		});
	}
	
	//console.log(storeData)
	storeData.sort(function(a,b){
		return a.pname.localeCompare(b.pname);
	});
	
	var folderConfigStore = new Ext.data.JsonStore({
		fields: [{
			name: 'pid',
			type: 'string'
		}, {
			name: 'pname',
			type: 'string'
		}],
		data: storeData
	});
	
	
	var configs = Ext.create('Ext.container.Container',{
		flex: 1,
		layout: 'card',
	    items: [
	        {
				xtype: "form",
				padding: 8,
				bodyStyle : 'background:none',
				border: false
			},
	        {
				xtype: "form",
				padding: 8,
				bodyStyle : 'background:none',
				border: false,
				autoScroll: true,
				layout: {
					type: 'vbox',
					align: 'stretch'
				},
				items: [
					{
						xtype:"displayfield",
						value: getText("Opacity")+":"
					},
					{
						xtype: "slider",
						id: "opacitySlider",
					    value: 100,
					    increment: 1,
					    minValue: 0,
						animate: false,
						listeners:
						{
							change: saveVisibility
						}
					},
					{
						xtype:"displayfield",
						value: getText("Primitives")+":"
					},
					Ext.create('Ext.ux.form.field.BoxSelect', {
						hideLabel: true,
						name: 'unfoldingPrimitives',
						id: 'unfoldingPrimitives',
						displayField: 'pname',
						valueField: 'pid',
						queryMode: 'local',
						store: primitiveConfigStore,
						emptyText: getText("Data"),
						listeners:
						{
							change: saveVisibility
						}
					}),
					{
						xtype: "button",
					    text    : getText('Select from Diagram'),
					    handler : function() {
							Ext.getCmp("unfoldingPrimitives").setValue(getSelected().map(function(x){return getID(x)}))
					    }
					}
						
					
				]
			},
	        {
				xtype: "form",
				padding: 8,
				bodyStyle : 'background:none',
				border: false,
				layout: {
					type: 'vbox',
					align: 'stretch'
				},
				items: [
					{
						xtype:"displayfield",
						value: getText("Message")+":"
					},
					{
						xtype: 'htmleditor',
						enableColors: false,
						enableSourceEdit: true,
						enableFont: false,
						enableLists: true,
						enableFontSize: false,
						id: "actionNote",
                		hideLabel: true,
						height: 200,
						listeners:
						{
							change: function(t, newvalue, oldvalue){
								if(! preventEdits){
									//console.log("change")
									//console.log(newvalue);
									//console.log(oldvalue)
									selectedNode.set("data", newvalue);
								}
								
							}
						}
				    }
				]
			},
	        {
				xtype: "form",
				padding: 8,
				bodyStyle : 'background:none',
				border: false,
			layout: {
				type: 'vbox',
				align: 'stretch'
			},
				items: [
					{
						xtype:"displayfield",
						value: getText("Action Code")+":"
					},
					{
						xtype: 'textareafield',
						id: "actionCode",
						rows:16,
						hideLabel:true,
						listeners:
						{
							change: function(t, newvalue, oldvalue){
								selectedNode.set("data", newvalue);
							}
						}
				    }
				]
			},
	        {
				xtype: "form",
				padding: 8,
				bodyStyle : 'background:none',
				border: false,
				plain: true,
				items: [
					{
						xtype: 'textfield',
						id: "groupName",
				        fieldLabel: getText('Name'),
						labelWidth: 60,
				        allowBlank: false,
						listeners:
						{
							change: function(t, newvalue, oldvalue){
								selectedNode.set("text", newvalue);
							}
						}
				    }
				]
			},
	        {
				xtype: "form",
				padding: 8,
				bodyStyle : 'background:none',
				border: false,
				autoScroll: true,
				layout: {
					type: 'vbox',
					align: 'stretch'
				},
				items: [
					{
						xtype:"displayfield",
						value: getText("Action")+":"
					},
					{
						xtype: "combo",
						id: "modeCombo",
						hideLabel: true,
						store: [ ["expand", getText("Expand")], ["collapse", getText("Collapse")]],
						forceSelection: true,
						listeners: {
							select: saveFolder
						}
						
					},
					{
						xtype:"displayfield",
						value: getText("Folders")+":"
					},
					Ext.create('Ext.ux.form.field.BoxSelect', {
						hideLabel: true,
						name: 'unfoldingFolders',
						id: 'unfoldingFolders',
						displayField: 'pname',
						valueField: 'pid',
						queryMode: 'local',
						store: folderConfigStore,
						emptyText: getText("Folders"),
						listeners:
						{
							change: saveFolder
						}
					})
						
					
				]
			}
	    ]
	});
	
	var p = {
		padding: 8,
		xtype: "container",
		frame: false,
		layout: {
			type: 'hbox',
			align: 'stretch'
		},
		items: [tree, configs]
	};

	var win = new Ext.Window({
		title: getText('Story Designer'),
		layout: 'fit',
		closeAction: 'destroy',
		border: false,
		modal: false,
		resizable: true,
		shadow: true,
		buttonAlign: 'right',
		width: 480,
		height: 420,
		items: [p],
		tbar: [
		 {
			xtype: "checkbox",
			id: "enabledChk",
			labelWidth:70,
			hideLabel: true,
			boxLabel: getText("Enabled"),
			checked: mySetting.getAttribute("unfoldingStatus")=="on",
			listeners: {
				change: function(combo, newValue, oldValue){
					if(newValue){
						Ext.getCmp("stepsTree").setDisabled(false);
					}else{
						Ext.getCmp("stepsTree").setDisabled(true);
						configs.getLayout().setActiveItem(0);
					}
				}
			}
		},'->',
		 {
			xtype: "combo",
			id: "autoCombo",
			fieldLabel: getText("Automatically View")+":",
			labelWidth: 130,
			store: [["never", getText("Never")], ["editors", getText("For Editors")], ["non-editors", getText("For Non-Editors")], ["always", getText("Always")]],
			forceSelection: true,
			value: mySetting.getAttribute("unfoldingAuto") || "non-editors",
			listeners: {
				select: function(combo, record){
					
				}
			}
		}
		],
		buttons: [{
			scale: "large",
			iconCls: "cancel-icon",
			text: getText('Cancel'),
			handler: function() {
				win.close();
			}
		}, {
			scale: "large",
			iconCls: "apply-icon",
			text: getText('Apply'),
			handler: function() {	
				var config = {
					steps: JSON.stringify(storeToJson()),
					enabled: Ext.getCmp("enabledChk").getValue()?"on":"off",
					auto: Ext.getCmp("autoCombo").getValue()
				}
			
				if(unfoldingManager.unfolding){
					restartUnfolding(config);
				}else{
					saveUnfoldingStatus(config);
				}
				handleUnfoldToolbar(true);
				
				
				win.close();
				
				
			}
		}]

	});

	win.show();

}
