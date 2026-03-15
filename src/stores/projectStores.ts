import { Task, Project } from '../types';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useProjectStore = defineStore('project', {
    state: () => ({
        projects: ref<Project[]>([])
    }),
    actions: {
        addProject(project: Project) {
            this.projects.value.push(project);
        }
    }
});
