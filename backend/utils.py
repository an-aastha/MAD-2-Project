from jinja2 import Template

def roles_list(roles):
    role_list = []
    for role in roles:
        role_list.append(role.name)
    return role_list


def format_report(template_path, data):
    with open(template_path) as f:
        template = Template(f.read())
    return template.render(data=data)
