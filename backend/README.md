# Traveling Allowance System Backend

This is the backend for the Traveling Allowance System project, built using Django and Django REST Framework.

## Project Structure

- **manage.py**: Entry point for the Django application.
- **requirements.txt**: Lists the required Python packages.
- **traveling_allowance/**: Contains the main Django project settings and configurations.
  - **settings.py**: Project settings including database configuration and installed apps.
  - **urls.py**: URL routing for the Django project.
  - **wsgi.py**: WSGI entry point for serving the application.
- **allowance/**: Contains the application logic for managing traveling allowances.
  - **models.py**: Data models for the traveling allowance system.
  - **views.py**: API endpoints for handling requests.
  - **serializers.py**: Serializers for converting model instances to JSON.
  - **urls.py**: URL routing specific to the allowance app.
  - **admin.py**: Registers models with the Django admin site.

## Setup Instructions

1. **Install Dependencies**: Run `pip install -r requirements.txt` to install the required packages.
2. **Run Migrations**: Execute `python manage.py migrate` to apply database migrations.
3. **Start the Server**: Use `python manage.py runserver` to start the development server.

## API Endpoints

- The API endpoints for managing traveling allowances will be defined in the `views.py` file within the allowance app.

## License

This project is licensed under the MIT License.