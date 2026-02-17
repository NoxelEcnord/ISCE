const { DataTypes } = require('sequelize');
const { database } = require('../../config');

// Target groups for the campaign
const CampaignGroupDB = database.define('campaign_groups', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    added_by: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'campaign_groups'
});

// Sticker flooding state
const CampaignStateDB = database.define('campaign_state', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    is_flooding: {
        type: DataTypes.BOOLEAN,
        defaultValue: true // Chilux Smart Default
    },
    sticker_count: {
        type: DataTypes.INTEGER, // 0 for infinite
        defaultValue: 0
    },
    interval_ms: {
        type: DataTypes.INTEGER,
        defaultValue: 10000 // Smart loop (10s)
    },
    ispeed: {
        type: DataTypes.STRING, // e.g., "3/4"
        defaultValue: "Auto"
    },
    banter_level: {
        type: DataTypes.INTEGER,
        defaultValue: 0 // 1-5 (Default 0 for defensive)
    },
    counter_mode: {
        type: DataTypes.BOOLEAN,
        defaultValue: true // Default true for defensive
    }
}, {
    timestamps: true,
    tableName: 'campaign_state'
});

// Campaign participants (foe/pal)
const CampaignParticipantDB = database.define('campaign_participants', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('pal', 'foe'),
        allowNull: false
    },
    added_by: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'campaign_participants'
});

// Group activity tracking for smart flooding
const GroupActivityDB = database.define('group_activity', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    last_message_time: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    },
    last_sender: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_bot_last: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    message_count_hour: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    last_count_reset: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    }
}, {
    timestamps: false,
    tableName: 'group_activity'
});

// Campaign templates
const CampaignTemplateDB = database.define('campaign_templates', {
    name: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    config: {
        type: DataTypes.JSON,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'campaign_templates'
});

async function initCampaignDB() {
    try {
        await CampaignGroupDB.sync({ alter: true });
        await CampaignStateDB.sync({ alter: true });
        await CampaignParticipantDB.sync({ alter: true });
        await GroupActivityDB.sync({ alter: true });
        await CampaignTemplateDB.sync({ alter: true });

        // Create default templates if they don't exist
        await createDefaultTemplates();

        console.log('Campaign database initialized');
    } catch (error) {
        console.error('Error initializing campaign database:', error);
    }
}

async function addCampaignGroup(jid, sender) {
    try {
        await CampaignGroupDB.findOrCreate({
            where: { jid },
            defaults: { added_by: sender }
        });
        return true;
    } catch (e) {
        console.error('Error adding campaign group:', e);
        return false;
    }
}

async function removeCampaignGroup(jid) {
    try {
        await CampaignGroupDB.destroy({ where: { jid } });
        return true;
    } catch (e) {
        console.error('Error removing campaign group:', e);
        return false;
    }
}

async function getCampaignGroups() {
    try {
        const groups = await CampaignGroupDB.findAll();
        return groups.map(g => g.jid);
    } catch (e) {
        console.error('Error getting campaign groups:', e);
        return [];
    }
}

async function updateCampaignState(updates) {
    try {
        let state = await CampaignStateDB.findOne();
        if (!state) {
            state = await CampaignStateDB.create(updates);
        } else {
            await state.update(updates);
        }
        return state;
    } catch (e) {
        console.error('Error updating campaign state:', e);
        return null;
    }
}

async function getCampaignState() {
    try {
        let state = await CampaignStateDB.findOne();
        if (!state) {
            state = await CampaignStateDB.create({});
        }
        return state;
    } catch (e) {
        console.error('Error getting campaign state:', e);
        return { is_flooding: false, sticker_count: 0, interval_ms: 0, banter_level: 0, counter_mode: true, ispeed: "0/0" };
    }
}

async function setParticipant(jid, type, addedBy) {
    try {
        const [participant, created] = await CampaignParticipantDB.findOrCreate({
            where: { jid },
            defaults: { type, added_by: addedBy }
        });
        if (!created) {
            await participant.update({ type, added_by: addedBy });
        }
        return true;
    } catch (e) {
        console.error('Error setting campaign participant:', e);
        return false;
    }
}

async function getParticipants() {
    try {
        return await CampaignParticipantDB.findAll();
    } catch (e) {
        console.error('Error getting campaign participants:', e);
        return [];
    }
}

async function getParticipant(jid) {
    try {
        return await CampaignParticipantDB.findOne({ where: { jid } });
    } catch (e) {
        return null;
    }
}

async function clearCampaignGroups() {
    try {
        await CampaignGroupDB.destroy({ where: {}, truncate: true });
        return true;
    } catch (e) {
        console.error('Error clearing campaign groups:', e);
        return false;
    }
}

// Activity tracking functions
async function updateActivity(jid, sender, isBotLast) {
    try {
        const now = Date.now();
        const [activity, created] = await GroupActivityDB.findOrCreate({
            where: { jid },
            defaults: {
                last_message_time: now,
                last_sender: sender,
                is_bot_last: isBotLast,
                message_count_hour: 1,
                last_count_reset: now
            }
        });

        if (!created) {
            // Reset hourly count if more than 1 hour passed
            const hourPassed = (now - activity.last_count_reset) > 3600000;
            await activity.update({
                last_message_time: now,
                last_sender: sender,
                is_bot_last: isBotLast,
                message_count_hour: hourPassed ? 1 : activity.message_count_hour + 1,
                last_count_reset: hourPassed ? now : activity.last_count_reset
            });
        }
        return activity;
    } catch (e) {
        console.error('Error updating activity:', e);
        return null;
    }
}

async function getActivity(jid) {
    try {
        return await GroupActivityDB.findOne({ where: { jid } });
    } catch (e) {
        console.error('Error getting activity:', e);
        return null;
    }
}

async function getActiveGroups(minutes = 30) {
    try {
        const cutoff = Date.now() - (minutes * 60 * 1000);
        const activities = await GroupActivityDB.findAll({
            where: {
                last_message_time: { [database.Sequelize.Op.gte]: cutoff }
            }
        });
        return activities.map(a => a.jid);
    } catch (e) {
        console.error('Error getting active groups:', e);
        return [];
    }
}

// Template functions
async function createDefaultTemplates() {
    const templates = [
        {
            name: 'aggressive',
            description: 'Maximum engagement - High banter, counter mode, fast flooding',
            config: {
                banter_level: 5,
                counter_mode: true,
                ispeed: '5/3',
                sticker_count: 0
            }
        },
        {
            name: 'moderate',
            description: 'Balanced approach - Medium banter, no counter, normal speed',
            config: {
                banter_level: 3,
                counter_mode: false,
                ispeed: '3/5',
                sticker_count: 0
            }
        },
        {
            name: 'stealth',
            description: 'Low profile - Minimal banter, slow flooding',
            config: {
                banter_level: 1,
                counter_mode: false,
                ispeed: '1/10',
                sticker_count: 0
            }
        },
        {
            name: 'defensive',
            description: 'Counter-only - No flooding, only respond to foes',
            config: {
                banter_level: 0,
                counter_mode: true,
                ispeed: '0/0',
                sticker_count: 0,
                is_flooding: false
            }
        },
        {
            name: 'chilux',
            description: 'Smart Mode - Auto-reply to activity (Pauses if bot last)',
            config: {
                banter_level: 3,
                counter_mode: true,
                ispeed: 'Auto',
                sticker_count: 0,
                is_flooding: true,
                interval_ms: 10000
            }
        }
    ];

    for (const template of templates) {
        try {
            await CampaignTemplateDB.findOrCreate({
                where: { name: template.name },
                defaults: template
            });
        } catch (e) {
            console.error(`Error creating template ${template.name}:`, e);
        }
    }
}

async function loadTemplate(name) {
    try {
        const template = await CampaignTemplateDB.findOne({ where: { name } });
        return template ? template.config : null;
    } catch (e) {
        console.error('Error loading template:', e);
        return null;
    }
}

async function saveTemplate(name, config, description = '') {
    try {
        const [template, created] = await CampaignTemplateDB.findOrCreate({
            where: { name },
            defaults: { config, description }
        });
        if (!created) {
            await template.update({ config, description });
        }
        return true;
    } catch (e) {
        console.error('Error saving template:', e);
        return false;
    }
}

async function listTemplates() {
    try {
        return await CampaignTemplateDB.findAll();
    } catch (e) {
        console.error('Error listing templates:', e);
        return [];
    }
}

module.exports = {
    initCampaignDB,
    addCampaignGroup,
    removeCampaignGroup,
    getCampaignGroups,
    clearCampaignGroups,
    updateCampaignState,
    getCampaignState,
    setParticipant,
    getParticipants,
    getParticipant,
    updateActivity,
    getActivity,
    getActiveGroups,
    loadTemplate,
    saveTemplate,
    listTemplates,
    CampaignGroupDB,
    CampaignStateDB,
    CampaignParticipantDB
};
