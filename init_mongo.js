// init_mongo.js
db = db.getSiblingDB('ssh_runner_db');

const collections = [
    'users', 'roles', 'user_roles', 'categories', 'systems',
    'scripts', 'hosts', 'projects', 'executions', 'project_access',
    'project_tasks', 'scheduler_jobs', 'scheduler_runs', 'audit_logs'
];

collections.forEach(coll => {
    if (!db.getCollectionNames().includes(coll)) {
        db.createCollection(coll);
        print('✅ Created: ' + coll);
    }
});

print('\n📊 Все коллекции:');
db.getCollectionNames().forEach(c => print('  - ' + c));