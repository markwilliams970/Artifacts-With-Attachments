Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    items: [
        {
            xtype: 'container',
            itemId: 'artifactTypeDropdown',
            columnWidth: 1
        },
        {
            xtype: 'container',
            itemId: 'gridContainer',
            columnWidth: 1
        }
    ],

    _rallyServer: window.location.hostname,
    _artifactTypeCombobox: null,
    _artifactStore: null,
    _artifactsWithAttachments: [],
    _artifactAttachmentGrid: null,

    launch: function() {

        var artifactTypesStore = Ext.create('Ext.data.Store', {
            fields: ['name', 'type'],
            data: [
                {"name": "Portfolio Item", "type": "PortfolioItem"},
                {"name": "User Story",     "type": "HierarchicalRequirement"},
                {"name": "Defect",         "type": "Defect"},
                {"name": "Test Case",      "type": "TestCase"},
                {"name": "Task",           "type": "Task"}
            ]
        });

        this._artifactTypeCombobox = Ext.create('Ext.form.ComboBox', {
            fieldLabel:   'Choose Artifact Type',
            store:        artifactTypesStore,
            queryMode:    'local',
            displayField: 'name',
            valueField:   'type',
            listeners: {
                scope: this,
                'select': this._getArtifacts
            }
        });

        this.down("#artifactTypeDropdown").add(this._artifactTypeCombobox);

    },

    _getArtifacts: function() {

        var selectedArtifactType = this._artifactTypeCombobox.getValue();

        this._artifactStore = Ext.create('Rally.data.wsapi.Store', {
            model: selectedArtifactType,
            fetch: ['ObjectID', 'FormattedID', 'Name', 'Attachments'],
            autoLoad: true,
            limit: 4000,
            context: {
                projectScopeUp: false,
                projectScopeDown: false
            },
            listeners: {
                scope: this,
                load: this._artifactStoreLoaded
            },
            filters: {
                property: 'Attachments.ObjectID',
                operator: '!=',
                value: "null"
            }
        });
    },

    _artifactStoreLoaded: function(store, records) {

        var me = this;

        me._artifactsWithAttachments = [];

        var artifactRecords = [];
        var promises = [];

        if (records.length === 0) {
            me._noArtifactsNotify();
        } else {

            Ext.Array.each(records, function(artifact) {
                promises.push(me._getArtifactAttachments(artifact, me));
            });

            Deft.Promise.all(promises).then({
                success: function(results) {
                    Ext.Array.each(results, function(result) {
                        me._artifactsWithAttachments.push(result);
                    });
                    me._makeGrid();
                }
            });
        }
    },

    _getArtifactAttachments: function(artifact, scope) {
        var deferred = Ext.create('Deft.Deferred');
        var me = scope;

        var attachments = [];
        var resultHash = {};

        var artifactRef = artifact.get('_ref');
        var artifactObjectID = artifact.get('ObjectID');
        var artifactFormattedID = artifact.get('FormattedID');
        var artifactName = artifact.get('Name');
        var attachmentCollection = artifact.getCollection("Attachments", {fetch: ['Name', 'ObjectID']});
        var attachmentCount = attachmentCollection.getCount();

        attachmentCollection.load({
            callback: function(records, operation, success) {
                Ext.Array.each(records, function(attachment) {
                    attachments.push(attachment);
                });
                result = {
                    "_ref": artifactRef,
                    "ObjectID": artifactObjectID,
                    "FormattedID": artifactFormattedID,
                    "Name": artifactName,
                    "Attachments": attachments
                };
                deferred.resolve(result);
            }
        });

        return deferred;
    },

    _makeGrid: function() {

        var me = this;

        if (me._artifactAttachmentGrid) {
            me._artifactAttachmentGrid.destroy();
        }


        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: me._artifactsWithAttachments,
            pageSize: 1000,
            remoteSort: false
        });

        me._artifactAttachmentGrid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'artifactGrid',
            store: gridStore,

            columnCfgs: [
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },
                {
                    text: 'Name', dataIndex: 'Name', flex: 1
                },
                {
                    text: 'Attachments', dataIndex: 'Attachments',
                    renderer: function(values) {
                        var attachmentsHtml = [];
                        Ext.Array.each(values, function(attachment) {
                            var attachmentObjectID = attachment.get('ObjectID');
                            var attachmentName = attachment.get('Name');
                            attachmentsHtml.push('<a href="https://rally1.rallydev.com/slm/attachment/' + attachmentObjectID + "/" + attachmentName + '">' + attachmentName + '</a>');                        });
                        return attachmentsHtml.join('<br/> ');
                    },
                    flex: 1
                }
            ]
        });

        me.down('#gridContainer').add(me._artifactAttachmentGrid);
        me._artifactsWithAttachments.reconfigure(gridStore);

    },

    _noArtifactsNotify: function() {
        this._artifactAttachmentGrid = this.down('#gridContainer').add({
            xtype: 'container',
            html: "No attachments found on Artifacts of selected Type."
        });
    }
});